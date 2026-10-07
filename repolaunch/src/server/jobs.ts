// Begrenzte Auftragsverwaltung in SQLite: Status, versionierte Befunde, TTL, Obergrenze aktiver Aufträge,
// nachvollziehbare Wiederaufnahme nach Neustart. Zugriff nur mit hochentropischem Schlüssel.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AiPackageResult } from "@/core/ai/generate";
import type { AiSection } from "@/core/ai/types";
import type { CachedResponse, EtagCache } from "@/core/github/http";
import type { AuditResult, RepoSnapshot, UserContext } from "@/core/types";
import { transaction, type Db } from "./db";

export type JobStatus = "queued" | "running" | "done" | "failed";
export type AiStatus = "none" | "queued" | "running" | "done" | "failed";

export interface JobInput {
  source: "github" | "fixture";
  owner: string;
  repo: string;
  fixtureName?: string;
  user: UserContext;
}

export interface AiRequest {
  sections: AiSection[];
  consentAt: string;
  provider: string;
  model: string;
}

export interface JobRow {
  id: string;
  key_hash: string;
  status: JobStatus;
  input_json: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  attempts: number;
  heartbeat_at: string | null;
  error_code: string | null;
  ruleset_version: string | null;
  commit_sha: string | null;
  analyzed_at: string | null;
  snapshot_json: string | null;
  audit_json: string | null;
  ai_status: AiStatus;
  ai_request_json: string | null;
  ai_result_json: string | null;
  ai_error_code: string | null;
  ai_runs: number;
  ai_attempts: number;
  ai_heartbeat_at: string | null;
}

export interface JobEvent {
  at: string;
  type: string;
  detail: string | null;
}

export class QueueFullError extends Error {
  constructor() {
    super("queue_full");
  }
}

export class AiLimitError extends Error {
  constructor() {
    super("ai_limit");
  }
}

export function hashKey(id: string, key: string): string {
  return createHash("sha256").update(`${id}:${key}`).digest("hex");
}

export type ClaimedJob = { kind: "audit"; row: JobRow } | { kind: "ai"; row: JobRow };

export class JobStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private iso(offsetMs = 0): string {
    return new Date(this.now().getTime() + offsetMs).toISOString();
  }

  activeCount(): number {
    const r = this.db
      .prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','running') OR ai_status IN ('queued','running')")
      .get() as { n: number };
    return Number(r.n);
  }

  create(input: JobInput, ttlHours: number, maxActive: number): { id: string; key: string; expiresAt: string } {
    const id = randomBytes(12).toString("base64url");
    const key = randomBytes(32).toString("base64url");
    const now = this.iso();
    const expiresAt = this.iso(ttlHours * 3_600_000);
    transaction(this.db, () => {
      if (this.activeCount() >= maxActive) throw new QueueFullError();
      this.db
        .prepare("INSERT INTO jobs (id, key_hash, status, input_json, created_at, updated_at, expires_at) VALUES (?, ?, 'queued', ?, ?, ?, ?)")
        .run(id, hashKey(id, key), JSON.stringify(input), now, now, expiresAt);
      this.event(id, "created", input.source === "fixture" ? "fixture" : null);
    });
    return { id, key, expiresAt };
  }

  /** Liefert den Auftrag nur bei gültigem Schlüssel und nicht abgelaufener Frist. */
  getAuthorized(id: string, key: string): JobRow | null {
    if (!/^[A-Za-z0-9_-]{16}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined;
    if (!row) return null;
    const expected = Buffer.from(row.key_hash, "hex");
    const actual = Buffer.from(hashKey(id, key), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    if (row.expires_at <= this.iso()) return null;
    return row;
  }

  getById(id: string): JobRow | null {
    return (this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as JobRow | undefined) ?? null;
  }

  events(id: string): JobEvent[] {
    return this.db.prepare("SELECT at, type, detail FROM job_events WHERE job_id = ? ORDER BY id").all(id) as unknown as JobEvent[];
  }

  event(id: string, type: string, detail: string | null = null): void {
    this.db.prepare("INSERT INTO job_events (job_id, at, type, detail) VALUES (?, ?, ?, ?)").run(id, this.iso(), type, detail ? detail.slice(0, 300) : null);
  }

  /** Nimmt atomar den ältesten wartenden Auftrag (Audit vor KI). Ein einzelner Worker verarbeitet seriell. */
  claimNext(): ClaimedJob | null {
    return transaction(this.db, () => {
      const now = this.iso();
      const audit = this.db
        .prepare(
          "UPDATE jobs SET status = 'running', attempts = attempts + 1, heartbeat_at = ?, updated_at = ? WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND expires_at > ? ORDER BY created_at LIMIT 1) RETURNING *",
        )
        .get(now, now, now) as JobRow | undefined;
      if (audit) {
        this.event(audit.id, "started", `attempt ${audit.attempts}`);
        return { kind: "audit" as const, row: audit };
      }
      const ai = this.db
        .prepare(
          "UPDATE jobs SET ai_status = 'running', ai_attempts = ai_attempts + 1, ai_heartbeat_at = ?, updated_at = ? WHERE id = (SELECT id FROM jobs WHERE status = 'done' AND ai_status = 'queued' AND expires_at > ? ORDER BY updated_at LIMIT 1) RETURNING *",
        )
        .get(now, now, now) as JobRow | undefined;
      if (ai) {
        this.event(ai.id, "ai_started", `attempt ${ai.ai_attempts}`);
        return { kind: "ai" as const, row: ai };
      }
      return null;
    });
  }

  heartbeat(id: string, kind: "audit" | "ai"): void {
    const col = kind === "audit" ? "heartbeat_at" : "ai_heartbeat_at";
    this.db.prepare(`UPDATE jobs SET ${col} = ? WHERE id = ?`).run(this.iso(), id);
  }

  completeAudit(id: string, snapshot: RepoSnapshot, audit: AuditResult): void {
    const now = this.iso();
    this.db
      .prepare(
        "UPDATE jobs SET status = 'done', updated_at = ?, error_code = NULL, ruleset_version = ?, commit_sha = ?, analyzed_at = ?, snapshot_json = ?, audit_json = ? WHERE id = ? AND status = 'running'",
      )
      .run(now, audit.rulesetVersion, snapshot.commitSha, snapshot.analyzedAt, JSON.stringify(snapshot), JSON.stringify(audit), id);
    this.event(id, "done", `commit ${snapshot.commitSha.slice(0, 7)}, ruleset ${audit.rulesetVersion}`);
  }

  failAudit(id: string, code: string): void {
    this.db.prepare("UPDATE jobs SET status = 'failed', updated_at = ?, error_code = ? WHERE id = ?").run(this.iso(), code, id);
    this.event(id, "failed", code);
  }

  requestAi(id: string, request: AiRequest, maxRuns: number): void {
    transaction(this.db, () => {
      const row = this.getById(id);
      if (!row || row.status !== "done") throw new Error("not_ready");
      if (row.ai_status === "queued" || row.ai_status === "running") return;
      if (row.ai_runs >= maxRuns) throw new AiLimitError();
      this.db
        .prepare("UPDATE jobs SET ai_status = 'queued', ai_request_json = ?, ai_error_code = NULL, ai_attempts = 0, ai_runs = ai_runs + 1, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(request), this.iso(), id);
      this.event(id, "ai_queued", `${request.provider} ${request.model}: ${request.sections.join(", ")}`);
    });
  }

  completeAi(id: string, result: AiPackageResult): void {
    this.db.prepare("UPDATE jobs SET ai_status = 'done', ai_result_json = ?, ai_error_code = NULL, updated_at = ? WHERE id = ?").run(JSON.stringify(result), this.iso(), id);
    this.event(id, "ai_done", result.cost.estimatedUsd === null ? null : `cost ~${result.cost.estimatedUsd} USD`);
  }

  failAi(id: string, code: string): void {
    this.db.prepare("UPDATE jobs SET ai_status = 'failed', ai_error_code = ?, updated_at = ? WHERE id = ?").run(code, this.iso(), id);
    this.event(id, "ai_failed", code);
  }

  delete(id: string): boolean {
    const r = this.db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
    return Number(r.changes) > 0;
  }

  /** Löscht abgelaufene Aufträge samt Ereignissen und alte Cache-Einträge. */
  purgeExpired(cacheMaxAgeHours = 24): { jobs: number; cache: number } {
    const jobs = this.db.prepare("DELETE FROM jobs WHERE expires_at <= ?").run(this.iso());
    const cache = this.db.prepare("DELETE FROM http_cache WHERE stored_at <= ?").run(this.iso(-cacheMaxAgeHours * 3_600_000));
    return { jobs: Number(jobs.changes), cache: Number(cache.changes) };
  }

  /**
   * Wiederaufnahme nach Neustart oder Absturz: laufende Aufträge ohne aktuellen Herzschlag gehen zurück in die
   * Warteschlange; nach maxAttempts Versuchen werden sie mit "interrupted" beendet.
   */
  recoverStale(staleMs: number, maxAttempts: number): { requeued: number; failed: number } {
    const cutoff = this.iso(-staleMs);
    let requeued = 0;
    let failed = 0;
    transaction(this.db, () => {
      const stale = this.db.prepare("SELECT id, attempts FROM jobs WHERE status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at <= ?)").all(cutoff) as { id: string; attempts: number }[];
      for (const j of stale) {
        if (j.attempts >= maxAttempts) {
          this.db.prepare("UPDATE jobs SET status = 'failed', error_code = 'interrupted', updated_at = ? WHERE id = ?").run(this.iso(), j.id);
          this.event(j.id, "failed", "interrupted");
          failed += 1;
        } else {
          this.db.prepare("UPDATE jobs SET status = 'queued', updated_at = ? WHERE id = ?").run(this.iso(), j.id);
          this.event(j.id, "resumed", `after attempt ${j.attempts}`);
          requeued += 1;
        }
      }
      const staleAi = this.db.prepare("SELECT id, ai_attempts FROM jobs WHERE ai_status = 'running' AND (ai_heartbeat_at IS NULL OR ai_heartbeat_at <= ?)").all(cutoff) as { id: string; ai_attempts: number }[];
      for (const j of staleAi) {
        if (j.ai_attempts >= maxAttempts) {
          this.db.prepare("UPDATE jobs SET ai_status = 'failed', ai_error_code = 'interrupted', updated_at = ? WHERE id = ?").run(this.iso(), j.id);
          this.event(j.id, "ai_failed", "interrupted");
          failed += 1;
        } else {
          this.db.prepare("UPDATE jobs SET ai_status = 'queued', updated_at = ? WHERE id = ?").run(this.iso(), j.id);
          this.event(j.id, "ai_resumed", `after attempt ${j.ai_attempts}`);
          requeued += 1;
        }
      }
    });
    return { requeued, failed };
  }
}

/** ETag-Cache für GitHub-Antworten in SQLite. Enthält nur öffentliche API-Antworten. */
export class SqliteEtagCache implements EtagCache {
  constructor(private readonly db: Db) {}

  get(key: string): CachedResponse | undefined {
    const row = this.db.prepare("SELECT etag, body FROM http_cache WHERE key = ?").get(key) as { etag: string; body: Uint8Array } | undefined;
    return row ? { etag: row.etag, body: new Uint8Array(row.body) } : undefined;
  }

  set(key: string, value: CachedResponse): void {
    if (value.body.byteLength > 600_000) return;
    this.db
      .prepare("INSERT INTO http_cache (key, etag, body, stored_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET etag = excluded.etag, body = excluded.body, stored_at = excluded.stored_at")
      .run(key, value.etag, value.body, new Date().toISOString());
  }
}
