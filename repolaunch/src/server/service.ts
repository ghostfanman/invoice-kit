// Anwendungslogik hinter den API-Routen. Unabhängig von Next.js testbar.

import { z } from "zod";
import { buildAiPayload } from "@/core/ai/payload";
import { buildDisclosure, type AiPackageResult } from "@/core/ai/generate";
import { AI_SECTIONS, type AiDisclosure } from "@/core/ai/types";
import { parseRepoInput } from "@/core/repo-input";
import { buildExport, snapshotSummary, type ExportBundle } from "@/core/report/export";
import { GOALS, LANGUAGES, PROJECT_TYPES, type AuditResult, type RepoSnapshot } from "@/core/types";
import { FIXTURE_REPOS } from "@/fixtures/repos";
import type { App } from "./app";
import { AiLimitError, QueueFullError, type AiRequest, type JobEvent, type JobInput, type JobRow } from "./jobs";
import { clientKey } from "./rate-limit";

export type ServiceResult<T> = { ok: true; status: number; body: T } | { ok: false; status: number; error: string; detail?: string; retryAfter?: number };

const createSchema = z
  .object({
    repo: z.string().max(300).optional(),
    fixture: z.string().max(40).optional(),
    goal: z.enum(GOALS),
    language: z.enum(LANGUAGES),
    audience: z.string().max(500).optional(),
    knownFeatures: z.string().max(2000).optional(),
    projectType: z.enum(PROJECT_TYPES).optional(),
  })
  .strict();

const aiSchema = z
  .object({
    consent: z.literal(true),
    sections: z.array(z.enum(AI_SECTIONS)).min(1).max(AI_SECTIONS.length),
  })
  .strict();

export const MAX_BODY_BYTES = 16_384;

function fail(status: number, error: string, detail?: string, retryAfter?: number): ServiceResult<never> {
  return { ok: false, status, error, detail, retryAfter };
}

function trimOrUndefined(s: string | undefined): string | undefined {
  const v = s?.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return v ? v : undefined;
}

export function createJob(app: App, body: unknown, headers: Headers): ServiceResult<{ id: string; key: string; expiresAt: string }> {
  const client = clientKey(headers, app.config.trustProxyHops);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_request");
  const b = parsed.data;

  let input: JobInput;
  const user = {
    goal: b.goal,
    language: b.language,
    audience: trimOrUndefined(b.audience),
    knownFeatures: trimOrUndefined(b.knownFeatures),
    projectTypeOverride: b.projectType,
  };
  if (b.fixture !== undefined) {
    if (!app.config.demoMode) return fail(403, "demo_disabled");
    const f = FIXTURE_REPOS.find((x) => x.name === b.fixture);
    if (!f) return fail(400, "invalid_request");
    input = { source: "fixture", owner: "repolaunch-fixtures", repo: f.name, fixtureName: f.name, user };
  } else {
    const r = parseRepoInput(b.repo);
    if (!r.ok) return fail(400, "invalid_repo", r.error);
    input = { source: "github", owner: r.owner, repo: r.repo, user };
  }

  const rl = app.limiters.jobs.take(client);
  if (!rl.allowed) return fail(429, "rate_limited_client", undefined, rl.retryAfterSeconds);
  try {
    const created = app.store.create(input, app.config.jobTtlHours, app.config.maxActiveJobs);
    app.worker.wake();
    return { ok: true, status: 201, body: created };
  } catch (err) {
    if (err instanceof QueueFullError) return fail(503, "queue_full", undefined, 60);
    throw err;
  }
}

export function bearerKey(headers: Headers): string | null {
  const h = headers.get("authorization");
  const m = h?.match(/^Bearer\s+([A-Za-z0-9_-]{43})$/);
  return m ? m[1]! : null;
}

function authorize(app: App, id: string, headers: Headers): ServiceResult<JobRow> {
  const rl = app.limiters.reads.take(clientKey(headers, app.config.trustProxyHops));
  if (!rl.allowed) return fail(429, "rate_limited_client", undefined, rl.retryAfterSeconds);
  const key = bearerKey(headers);
  const row = key ? app.store.getAuthorized(id, key) : null;
  if (!row) return fail(404, "not_found");
  return { ok: true, status: 200, body: row };
}

export interface AiAvailability {
  configured: boolean;
  provider: string | null;
  model: string | null;
  isTestAdapter: boolean;
  runsLeft: number;
  disclosure: AiDisclosure | null;
}

export interface JobView {
  id: string;
  status: JobRow["status"];
  createdAt: string;
  expiresAt: string;
  errorCode: string | null;
  input: JobInput;
  events: JobEvent[];
  snapshot: ReturnType<typeof snapshotSummary> | null;
  audit: AuditResult | null;
  ai: {
    status: JobRow["ai_status"];
    errorCode: string | null;
    request: AiRequest | null;
    result: Omit<AiPackageResult, "disclosure"> | null;
    availability: AiAvailability;
  };
}

export function getJobView(app: App, id: string, headers: Headers): ServiceResult<JobView> {
  const auth = authorize(app, id, headers);
  if (!auth.ok) return auth;
  const row = auth.body;
  const input = JSON.parse(row.input_json) as JobInput;
  const snapshot = row.snapshot_json ? (JSON.parse(row.snapshot_json) as RepoSnapshot) : null;
  const audit = row.audit_json ? (JSON.parse(row.audit_json) as AuditResult) : null;
  const aiResult = row.ai_result_json ? (JSON.parse(row.ai_result_json) as AiPackageResult) : null;

  let disclosure: AiDisclosure | null = null;
  if (app.provider && snapshot && audit) {
    disclosure = buildDisclosure(app.provider, buildAiPayload(snapshot, audit, input.user, [...AI_SECTIONS], app.config.ai.limits), app.config.ai.limits);
  }
  let resultWithoutDisclosure: JobView["ai"]["result"] = null;
  if (aiResult) {
    const { disclosure: _omit, ...rest } = aiResult;
    void _omit;
    resultWithoutDisclosure = rest;
  }
  return {
    ok: true,
    status: 200,
    body: {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      errorCode: row.error_code,
      input,
      events: app.store.events(row.id),
      snapshot: snapshot ? snapshotSummary(snapshot) : null,
      audit,
      ai: {
        status: row.ai_status,
        errorCode: row.ai_error_code,
        request: row.ai_request_json ? (JSON.parse(row.ai_request_json) as AiRequest) : null,
        result: resultWithoutDisclosure,
        availability: {
          configured: Boolean(app.provider),
          provider: app.provider?.displayName ?? null,
          model: app.provider?.model ?? null,
          isTestAdapter: app.provider?.id === "fake",
          runsLeft: Math.max(0, app.config.ai.limits.maxRunsPerJob - row.ai_runs),
          disclosure,
        },
      },
    },
  };
}

export function requestAi(app: App, id: string, body: unknown, headers: Headers): ServiceResult<{ status: "queued" }> {
  const auth = authorize(app, id, headers);
  if (!auth.ok) return auth;
  if (!app.provider) return fail(409, "ai_not_configured");
  if (!body || typeof body !== "object" || (body as { consent?: unknown }).consent !== true) return fail(400, "consent_required");
  const parsed = aiSchema.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_request");
  if (auth.body.status !== "done") return fail(409, "not_ready");
  const rl = app.limiters.ai.take(clientKey(headers, app.config.trustProxyHops));
  if (!rl.allowed) return fail(429, "rate_limited_client", undefined, rl.retryAfterSeconds);
  try {
    app.store.requestAi(
      id,
      { sections: [...new Set(parsed.data.sections)], consentAt: new Date().toISOString(), provider: app.provider.displayName, model: app.provider.model },
      app.config.ai.limits.maxRunsPerJob,
    );
  } catch (err) {
    if (err instanceof AiLimitError) return fail(409, "ai_limit");
    if (err instanceof Error && err.message === "not_ready") return fail(409, "not_ready");
    throw err;
  }
  app.worker.wake();
  return { ok: true, status: 202, body: { status: "queued" } };
}

export function exportJob(app: App, id: string, headers: Headers): ServiceResult<ExportBundle> {
  const auth = authorize(app, id, headers);
  if (!auth.ok) return auth;
  const row = auth.body;
  if (row.status !== "done" || !row.snapshot_json || !row.audit_json) return fail(409, "not_ready");
  const input = JSON.parse(row.input_json) as JobInput;
  const ai = row.ai_status === "done" && row.ai_result_json ? (JSON.parse(row.ai_result_json) as AiPackageResult) : null;
  return { ok: true, status: 200, body: buildExport(JSON.parse(row.snapshot_json) as RepoSnapshot, JSON.parse(row.audit_json) as AuditResult, input.user, ai) };
}

export function deleteJob(app: App, id: string, headers: Headers): ServiceResult<null> {
  const auth = authorize(app, id, headers);
  if (!auth.ok) return auth;
  app.store.delete(id);
  return { ok: true, status: 204, body: null };
}
