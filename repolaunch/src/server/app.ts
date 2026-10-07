// Prozessweiter Anwendungszustand: Konfiguration, Datenbank, Auftragsspeicher, Limits und ein einzelner Worker.
// Das MVP läuft als genau ein Node-Prozess (next start). Keine serverlosen Annahmen.

import { runAiPackage } from "@/core/ai/generate";
import { LlmError, type LlmProvider } from "@/core/ai/types";
import { collectSnapshot } from "@/core/github/collector";
import { CollectError } from "@/core/github/errors";
import { FIXTURE_OWNER, fixtureTransport } from "@/core/github/fixture-transport";
import { fetchTransport, GitHubHttp, type Transport } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS, type CollectLimits } from "@/core/limits";
import { runAudit } from "@/core/rules/engine";
import type { AuditResult, RepoSnapshot } from "@/core/types";
import { FIXTURE_REPOS } from "@/fixtures/repos";
import { configSecrets, createProvider, getConfig, type ServerConfig } from "./config";
import { openDb, type Db } from "./db";
import { JobStore, SqliteEtagCache, type AiRequest, type JobInput, type JobRow } from "./jobs";
import { log } from "./log";
import { FixedWindowLimiter } from "./rate-limit";

const HEARTBEAT_MS = 5_000;
const STALE_MS = 60_000;
const MAINTENANCE_MS = 10 * 60_000;

export interface App {
  config: ServerConfig;
  db: Db;
  store: JobStore;
  provider: LlmProvider | null;
  limiters: { jobs: FixedWindowLimiter; ai: FixedWindowLimiter; reads: FixedWindowLimiter };
  worker: Worker;
}

export interface AppOverrides {
  db?: Db;
  provider?: LlmProvider | null;
  transport?: Transport;
  collectLimits?: CollectLimits;
  now?: () => Date;
}

export function createApp(config: ServerConfig, overrides: AppOverrides = {}): App {
  const db = overrides.db ?? openDb(config.dbFile);
  const store = new JobStore(db, overrides.now);
  const provider = overrides.provider !== undefined ? overrides.provider : createProvider(config);
  const app: App = {
    config,
    db,
    store,
    provider,
    limiters: {
      jobs: new FixedWindowLimiter(config.rateLimitJobsPerHour, 3_600_000),
      ai: new FixedWindowLimiter(config.rateLimitAiPerHour, 3_600_000),
      reads: new FixedWindowLimiter(config.rateLimitReadsPerMinute, 60_000),
    },
    worker: undefined as unknown as Worker,
  };
  app.worker = new Worker(app, overrides.transport ?? fetchTransport, overrides.collectLimits ?? DEFAULT_COLLECT_LIMITS);
  return app;
}

export class Worker {
  private running = false;
  private wakeUp: (() => void) | null = null;
  private lastMaintenance = 0;
  private readonly etagCache: SqliteEtagCache;

  constructor(
    private readonly app: App,
    private readonly liveTransport: Transport,
    private readonly collectLimits: CollectLimits,
  ) {
    this.etagCache = new SqliteEtagCache(app.db);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const r = this.app.store.recoverStale(0, this.app.config.maxJobAttempts);
    if (r.requeued || r.failed) log("info", "worker.recovered", { requeued: r.requeued, failed: r.failed });
    void this.loop();
    log("info", "worker.started", { aiProvider: this.app.provider?.id ?? "none", demo: this.app.config.demoMode });
  }

  stop(): void {
    this.running = false;
    this.wakeUp?.();
  }

  wake(): void {
    this.wakeUp?.();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let worked = false;
      try {
        worked = await this.runOnce();
      } catch (err) {
        log("error", "worker.loop_error", { error: err instanceof Error ? err.name : "unknown" });
      }
      if (!worked && this.running) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 1000);
          this.wakeUp = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        this.wakeUp = null;
      }
    }
  }

  /** Verarbeitet höchstens einen Auftrag. Liefert true, wenn etwas zu tun war. */
  async runOnce(): Promise<boolean> {
    const nowMs = Date.now();
    if (nowMs - this.lastMaintenance > MAINTENANCE_MS) {
      this.lastMaintenance = nowMs;
      const p = this.app.store.purgeExpired();
      const r = this.app.store.recoverStale(STALE_MS, this.app.config.maxJobAttempts);
      if (p.jobs || p.cache || r.requeued || r.failed) log("info", "worker.maintenance", { purgedJobs: p.jobs, purgedCache: p.cache, requeued: r.requeued, failed: r.failed });
    }
    const claimed = this.app.store.claimNext();
    if (!claimed) return false;
    if (claimed.kind === "audit") await this.processAudit(claimed.row);
    else await this.processAi(claimed.row);
    return true;
  }

  private async processAudit(row: JobRow): Promise<void> {
    const input = JSON.parse(row.input_json) as JobInput;
    const started = Date.now();
    const beat = setInterval(() => this.app.store.heartbeat(row.id, "audit"), HEARTBEAT_MS);
    try {
      const fixture = input.source === "fixture";
      const http = new GitHubHttp({
        limits: this.collectLimits,
        transport: fixture ? fixtureTransport(FIXTURE_REPOS) : this.liveTransport,
        token: fixture ? undefined : this.app.config.githubToken,
        cache: fixture ? undefined : this.etagCache,
        logger: { request: (e) => log("info", "github.request", { job: row.id, path: e.path.replace(/^\/repos\/[^/]+\/[^/]+/, "/repos/{o}/{r}"), status: e.status, ms: e.ms, attempt: e.attempt }) },
      });
      const snapshot = await collectSnapshot(
        http,
        { owner: fixture ? FIXTURE_OWNER : input.owner, repo: fixture ? input.fixtureName! : input.repo, goal: input.user.goal, source: input.source, fixtureName: input.fixtureName },
        this.collectLimits,
      );
      const audit = runAudit(snapshot, input.user, { config: this.app.config.rules });
      this.app.store.completeAudit(row.id, snapshot, audit);
      log("info", "job.done", { job: row.id, ms: Date.now() - started, requests: snapshot.stats.requests, findings: audit.findings.length });
    } catch (err) {
      const code = err instanceof CollectError ? err.code : "internal_error";
      if (err instanceof CollectError && code === "rate_limited") {
        this.app.store.event(row.id, "rate_limited", err.resetAt ? `reset ${err.resetAt}` : err.retryAfterSeconds ? `retry-after ${err.retryAfterSeconds}s` : null);
      }
      this.app.store.failAudit(row.id, code);
      log(code === "internal_error" ? "error" : "warn", "job.failed", { job: row.id, code, error: err instanceof Error && code === "internal_error" ? err.name : undefined });
    } finally {
      clearInterval(beat);
    }
  }

  private async processAi(row: JobRow): Promise<void> {
    const beat = setInterval(() => this.app.store.heartbeat(row.id, "ai"), HEARTBEAT_MS);
    try {
      const provider = this.app.provider;
      if (!provider) throw new LlmError("not_configured", "Kein KI-Anbieter konfiguriert.");
      const input = JSON.parse(row.input_json) as JobInput;
      const request = JSON.parse(row.ai_request_json ?? "{}") as AiRequest;
      const snapshot = JSON.parse(row.snapshot_json ?? "null") as RepoSnapshot;
      const audit = JSON.parse(row.audit_json ?? "null") as AuditResult;
      const result = await runAiPackage({
        provider,
        snapshot,
        audit,
        user: input.user,
        sections: request.sections,
        limits: this.app.config.ai.limits,
        secrets: configSecrets(this.app.config),
      });
      this.app.store.completeAi(row.id, result);
      log("info", "ai.done", { job: row.id, provider: provider.id, model: result.model, costUsd: result.cost.estimatedUsd ?? undefined, unverified: result.checks.filter((c) => c.status === "unverified").length });
    } catch (err) {
      const code = err instanceof LlmError ? err.code : "internal_error";
      this.app.store.failAi(row.id, code);
      log(code === "internal_error" ? "error" : "warn", "ai.failed", { job: row.id, code });
    } finally {
      clearInterval(beat);
    }
  }
}

const GLOBAL_KEY = Symbol.for("repolaunch.app");

/** Prozessweite Instanz. Startet den Worker beim ersten Zugriff. */
export function getApp(): App {
  const g = globalThis as unknown as Record<symbol, App | undefined>;
  let app = g[GLOBAL_KEY];
  if (!app) {
    app = createApp(getConfig());
    g[GLOBAL_KEY] = app;
    app.worker.start();
  }
  return app;
}
