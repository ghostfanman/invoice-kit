// Begrenzter HTTP-Client für die GitHub REST API.
// - Ausschließlich https://api.github.com, keine beliebigen URLs.
// - Anfragen seriell (GitHub-Empfehlung gegen sekundäre Ratenlimits).
// - Weiterleitungen nur innerhalb von api.github.com und höchstens zwei pro Anfrage.
// - Größen-, Anfrage- und Zeitbudget pro Auftrag, ETag-Cache, Retry-After.

import type { CollectLimits } from "../limits";
import type { RequestStats } from "../types";
import { CollectError, ResponseTooLargeError } from "./errors";

export const GITHUB_API_ORIGIN = "https://api.github.com";
const API_VERSION = "2022-11-28";
const USER_AGENT = "RepoLaunch-MVP (read-only audit)";

export type Transport = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;

export interface CachedResponse {
  etag: string;
  body: Uint8Array;
}

export interface EtagCache {
  get(key: string): CachedResponse | undefined;
  set(key: string, value: CachedResponse): void;
}

export interface GitHubResponse {
  status: number;
  body: Uint8Array;
  fromCache: boolean;
}

export interface HttpLogger {
  request(entry: { path: string; status: number | "error"; ms: number; attempt: number }): void;
}

export const fetchTransport: Transport = (url, init) =>
  fetch(url, { headers: init.headers, signal: init.signal, redirect: "manual", cache: "no-store" });

const SAFE_PATH_RE = /^\/(repos|repositories)\/[A-Za-z0-9._\-/%]+(\?[A-Za-z0-9._\-=&%+]*)?$/;

/** Prüft, dass ein Pfad nur auf erlaubte API-Ressourcen zeigt und baut die absolute URL. */
export function buildApiUrl(pathAndQuery: string): string {
  if (!SAFE_PATH_RE.test(pathAndQuery) || pathAndQuery.includes("..") || pathAndQuery.includes("//")) {
    throw new CollectError("invalid_response", "Unzulässiger API-Pfad");
  }
  const url = new URL(pathAndQuery, GITHUB_API_ORIGIN);
  if (url.origin !== GITHUB_API_ORIGIN) throw new CollectError("invalid_response", "Unzulässiger API-Host");
  return url.toString();
}

/** Akzeptiert Weiterleitungen nur auf api.github.com und bekannte Ressourcenpfade. */
export function validateRedirect(location: string | null, currentUrl: string): string {
  if (!location) throw new CollectError("redirect_rejected", "Weiterleitung ohne Ziel");
  let target: URL;
  try {
    target = new URL(location, currentUrl);
  } catch {
    throw new CollectError("redirect_rejected", "Ungültiges Weiterleitungsziel");
  }
  if (target.origin !== GITHUB_API_ORIGIN || target.username || target.password) {
    throw new CollectError("redirect_rejected", "Weiterleitung auf fremden Host abgelehnt");
  }
  const pathAndQuery = target.pathname + target.search;
  return buildApiUrl(pathAndQuery);
}

export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "NaN");
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError(maxBytes);
  }
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export interface GitHubHttpOptions {
  limits: CollectLimits;
  transport?: Transport;
  token?: string;
  cache?: EtagCache;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  logger?: HttpLogger;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class GitHubHttp {
  readonly stats: RequestStats = { requests: 0, notModified: 0, bytes: 0, durationMs: 0 };
  private readonly limits: CollectLimits;
  private readonly transport: Transport;
  private readonly token?: string;
  private readonly cache?: EtagCache;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly logger?: HttpLogger;
  private readonly startedAt: number;
  private readonly deadline: AbortController;
  private readonly deadlineTimer: ReturnType<typeof setTimeout>;

  constructor(opts: GitHubHttpOptions) {
    this.limits = opts.limits;
    this.transport = opts.transport ?? fetchTransport;
    this.token = opts.token;
    this.cache = opts.cache;
    this.sleep = opts.sleep ?? defaultSleep;
    this.now = opts.now ?? Date.now;
    this.logger = opts.logger;
    this.startedAt = this.now();
    this.deadline = new AbortController();
    this.deadlineTimer = setTimeout(() => this.deadline.abort(), this.limits.deadlineMs);
  }

  close(): void {
    clearTimeout(this.deadlineTimer);
    this.stats.durationMs = this.now() - this.startedAt;
  }

  /**
   * Führt eine GET-Anfrage aus. 404, 409 und 422 werden als Status zurückgegeben,
   * damit der Aufrufer zwischen "fehlt" und Fehlern unterscheiden kann.
   */
  async get(pathAndQuery: string, accept: string, maxBytes: number): Promise<GitHubResponse> {
    let url = buildApiUrl(pathAndQuery);
    let redirects = 0;
    let attempt = 0;
    const cacheKey = () => `${accept} ${url}`;

    for (;;) {
      if (this.deadline.signal.aborted) throw new CollectError("timeout", "Zeitlimit der Erfassung überschritten");
      if (this.stats.requests >= this.limits.maxRequests) {
        throw new CollectError("limit_exceeded", `Anfragebudget von ${this.limits.maxRequests} erschöpft`);
      }
      this.stats.requests += 1;
      attempt += 1;

      const headers: Record<string, string> = {
        Accept: accept,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": API_VERSION,
      };
      if (this.token) headers.Authorization = `Bearer ${this.token}`;
      const cached = this.cache?.get(cacheKey());
      if (cached) headers["If-None-Match"] = cached.etag;

      const signal = AbortSignal.any([this.deadline.signal, AbortSignal.timeout(this.limits.requestTimeoutMs)]);
      const started = this.now();
      let res: Response;
      try {
        res = await this.transport(url, { headers, signal });
      } catch {
        this.logger?.request({ path: logPath(url), status: "error", ms: this.now() - started, attempt });
        if (this.deadline.signal.aborted) throw new CollectError("timeout", "Zeitlimit der Erfassung überschritten");
        if (attempt <= this.limits.maxRetries) {
          await this.sleep(backoff(attempt));
          continue;
        }
        throw new CollectError("github_api_error", "GitHub nicht erreichbar (Netzwerkfehler oder Zeitüberschreitung)");
      }
      this.logger?.request({ path: logPath(url), status: res.status, ms: this.now() - started, attempt });

      if (res.status === 304 && cached) {
        await res.body?.cancel().catch(() => undefined);
        this.stats.notModified += 1;
        return { status: 200, body: cached.body, fromCache: true };
      }

      if ([301, 302, 307, 308].includes(res.status)) {
        await res.body?.cancel().catch(() => undefined);
        redirects += 1;
        if (redirects > 2) throw new CollectError("redirect_rejected", "Zu viele Weiterleitungen");
        url = validateRedirect(res.headers.get("location"), url);
        continue;
      }

      if (res.status >= 200 && res.status < 300) {
        const body = await this.readBody(res, maxBytes);
        const etag = res.headers.get("etag");
        if (etag && this.cache) this.cache.set(cacheKey(), { etag, body });
        return { status: res.status, body, fromCache: false };
      }

      if (res.status === 404 || res.status === 409 || res.status === 422) {
        await res.body?.cancel().catch(() => undefined);
        return { status: res.status, body: new Uint8Array(), fromCache: false };
      }

      if (res.status === 401) {
        await res.body?.cancel().catch(() => undefined);
        throw new CollectError("auth_config", "GitHub lehnt das konfigurierte Token ab (401)", { status: 401 });
      }

      if (res.status === 403 || res.status === 429) {
        await res.body?.cancel().catch(() => undefined);
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
        const remaining = res.headers.get("x-ratelimit-remaining");
        const reset = res.headers.get("x-ratelimit-reset");
        if (retryAfter !== null) {
          if (retryAfter * 1000 <= this.limits.maxRetryWaitMs && attempt <= this.limits.maxRetries) {
            await this.sleep(retryAfter * 1000);
            continue;
          }
          throw new CollectError("rate_limited", "GitHub-Ratenlimit erreicht", { status: res.status, retryAfterSeconds: retryAfter });
        }
        if (remaining === "0") {
          const resetAt = reset && /^\d+$/.test(reset) ? new Date(Number(reset) * 1000).toISOString() : undefined;
          throw new CollectError("rate_limited", "GitHub-Ratenlimit erschöpft", { status: res.status, resetAt });
        }
        if (res.status === 429) {
          // Sekundäres Limit ohne Header: GitHub empfiehlt mindestens eine Minute Pause.
          throw new CollectError("rate_limited", "GitHub-Ratenlimit erreicht", { status: 429, retryAfterSeconds: 60 });
        }
        throw new CollectError("access_blocked", "GitHub verweigert den Zugriff (403)", { status: 403 });
      }

      if (res.status === 451) {
        await res.body?.cancel().catch(() => undefined);
        throw new CollectError("access_blocked", "Repository aus rechtlichen Gründen nicht verfügbar (451)", { status: 451 });
      }

      await res.body?.cancel().catch(() => undefined);
      if (res.status >= 500 && attempt <= this.limits.maxRetries) {
        await this.sleep(backoff(attempt));
        continue;
      }
      throw new CollectError("github_api_error", `Unerwartete GitHub-Antwort (${res.status})`, { status: res.status });
    }
  }

  async getJson<T = unknown>(pathAndQuery: string, maxBytes = this.limits.maxResponseBytes): Promise<{ status: number; data: T | null }> {
    const res = await this.get(pathAndQuery, "application/vnd.github+json", maxBytes);
    if (res.status !== 200) return { status: res.status, data: null };
    try {
      return { status: 200, data: JSON.parse(new TextDecoder().decode(res.body)) as T };
    } catch {
      throw new CollectError("invalid_response", "GitHub-Antwort ist kein gültiges JSON");
    }
  }

  private async readBody(res: Response, maxBytes: number): Promise<Uint8Array> {
    const remainingBudget = this.limits.maxTotalBytes - this.stats.bytes;
    if (remainingBudget <= 0) {
      await res.body?.cancel().catch(() => undefined);
      throw new CollectError("limit_exceeded", "Datenbudget der Erfassung erschöpft");
    }
    const cap = Math.min(maxBytes, remainingBudget);
    try {
      const body = await readCapped(res, cap);
      this.stats.bytes += body.byteLength;
      return body;
    } catch (err) {
      if (err instanceof ResponseTooLargeError && cap < maxBytes) {
        throw new CollectError("limit_exceeded", "Datenbudget der Erfassung erschöpft");
      }
      if (err instanceof ResponseTooLargeError) throw err;
      if (this.deadline.signal.aborted) throw new CollectError("timeout", "Zeitlimit der Erfassung überschritten");
      throw new CollectError("github_api_error", "Antwort konnte nicht vollständig gelesen werden");
    }
  }
}

export function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  if (/^\d+$/.test(value.trim())) return Number(value.trim());
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function backoff(attempt: number): number {
  return Math.min(4000, 500 * 3 ** (attempt - 1));
}

/** Für Logs: nur Pfad ohne Query, keine Tokens oder Inhalte. */
function logPath(url: string): string {
  return new URL(url).pathname;
}
