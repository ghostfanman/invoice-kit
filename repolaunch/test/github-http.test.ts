import { describe, expect, it, vi } from "vitest";
import { CollectError, ResponseTooLargeError } from "@/core/github/errors";
import { buildApiUrl, GitHubHttp, validateRedirect, type CachedResponse, type EtagCache, type Transport } from "@/core/github/http";
import { DEFAULT_COLLECT_LIMITS, type CollectLimits } from "@/core/limits";

const limits = (over: Partial<CollectLimits> = {}): CollectLimits => ({ ...DEFAULT_COLLECT_LIMITS, ...over });

type Spec = { status: number; body?: string | null; headers?: Record<string, string> } | Error;

/** Liefert bei jedem Aufruf eine frische Response (keine geklonten Streams). */
function seq(specs: Spec[]): { transport: Transport; calls: { url: string; headers: Record<string, string> }[] } {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let i = 0;
  const transport: Transport = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const s = specs[Math.min(i++, specs.length - 1)]!;
    if (s instanceof Error) throw s;
    return new Response(s.body ?? null, { status: s.status, headers: s.headers });
  };
  return { transport, calls };
}

const ok = (body: unknown, headers: Record<string, string> = {}): Spec => ({ status: 200, body: JSON.stringify(body), headers });
const res = (status: number, headers: Record<string, string> = {}, body: string | null = null): Spec => ({ status, headers, body });

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "resolved";
  } catch (e) {
    return e instanceof CollectError ? e.code : e instanceof ResponseTooLargeError ? "too_large" : String(e);
  }
}

describe("Feste API-Hosts und Weiterleitungen", () => {
  it("baut nur Pfade unter api.github.com", () => {
    expect(buildApiUrl("/repos/a/b")).toBe("https://api.github.com/repos/a/b");
    for (const bad of ["https://evil.com/repos/a/b", "//evil.com/repos/a", "/repos/a/../../x", "/users/a", "/repos/a/b?x=<script>", "/repos/a//b"]) {
      expect(() => buildApiUrl(bad)).toThrow(CollectError);
    }
  });

  it("akzeptiert Weiterleitungen nur auf api.github.com", () => {
    expect(validateRedirect("https://api.github.com/repositories/123", "https://api.github.com/repos/a/b")).toBe("https://api.github.com/repositories/123");
    expect(validateRedirect("/repositories/9/readme", "https://api.github.com/repos/a/b")).toBe("https://api.github.com/repositories/9/readme");
    for (const bad of ["https://evil.com/repositories/1", "http://api.github.com/repositories/1", "https://user@api.github.com/repositories/1", "https://169.254.169.254/latest", null]) {
      expect(() => validateRedirect(bad, "https://api.github.com/repos/a/b")).toThrow(CollectError);
    }
  });

  it("folgt einer erlaubten Weiterleitung und lehnt fremde Ziele ab", async () => {
    const good = seq([res(301, { location: "https://api.github.com/repositories/42" }), ok({ full_name: "new/name" })]);
    const http = new GitHubHttp({ limits: limits(), transport: good.transport });
    expect((await http.getJson<{ full_name: string }>("/repos/old/name")).data?.full_name).toBe("new/name");
    expect(good.calls[1]!.url).toBe("https://api.github.com/repositories/42");

    const bad = seq([res(302, { location: "https://raw.githubusercontent.com/x" })]);
    expect(await code(new GitHubHttp({ limits: limits(), transport: bad.transport }).getJson("/repos/a/b"))).toBe("redirect_rejected");
  });
});

describe("Budgets und Größenlimits", () => {
  it("bricht nach dem Anfragebudget ab", async () => {
    const { transport } = seq([ok({})]);
    const http = new GitHubHttp({ limits: limits({ maxRequests: 2 }), transport });
    await http.getJson("/repos/a/b");
    await http.getJson("/repos/a/b");
    expect(await code(http.getJson("/repos/a/b"))).toBe("limit_exceeded");
  });

  it("verwirft zu große Antworten anhand von Content-Length und beim Streamen", async () => {
    const declared = seq([res(200, { "content-length": "999999" }, "x".repeat(10))]);
    expect(await code(new GitHubHttp({ limits: limits(), transport: declared.transport }).get("/repos/a/b", "application/json", 100))).toBe("too_large");
    const streamed = seq([res(200, {}, "x".repeat(500))]);
    expect(await code(new GitHubHttp({ limits: limits(), transport: streamed.transport }).get("/repos/a/b", "application/json", 100))).toBe("too_large");
  });

  it("begrenzt die Gesamtmenge gelesener Bytes", async () => {
    const { transport } = seq([res(200, {}, "y".repeat(80))]);
    const http = new GitHubHttp({ limits: limits({ maxTotalBytes: 100 }), transport });
    await http.get("/repos/a/b", "application/json", 1000);
    expect(await code(http.get("/repos/a/b", "application/json", 1000))).toBe("limit_exceeded");
  });

  it("meldet Zeitüberschreitung der Gesamterfassung", async () => {
    const transport: Transport = (_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    const http = new GitHubHttp({ limits: limits({ deadlineMs: 50, requestTimeoutMs: 5000 }), transport, sleep: async () => {} });
    expect(await code(http.getJson("/repos/a/b"))).toBe("timeout");
  });
});

describe("Ratenlimits, Retry-After und Fehlerarten", () => {
  it("wartet bei kurzem Retry-After und wiederholt einmal", async () => {
    const sleep = vi.fn(async () => {});
    const { transport, calls } = seq([res(429, { "retry-after": "2" }), ok({ a: 1 })]);
    const r = await new GitHubHttp({ limits: limits(), transport, sleep }).getJson<{ a: number }>("/repos/a/b");
    expect(r.data).toEqual({ a: 1 });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(calls).toHaveLength(2);
  });

  it("bricht bei langem Retry-After ehrlich ab, statt lange zu warten", async () => {
    const sleep = vi.fn(async () => {});
    const { transport } = seq([res(403, { "retry-after": "120" })]);
    const http = new GitHubHttp({ limits: limits(), transport, sleep });
    await expect(http.getJson("/repos/a/b")).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: 120 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it("erkennt erschöpftes Primärlimit mit Reset-Zeit", async () => {
    const { transport } = seq([res(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1791404365" })]);
    await expect(new GitHubHttp({ limits: limits(), transport }).getJson("/repos/a/b")).rejects.toMatchObject({ code: "rate_limited", resetAt: new Date(1791404365 * 1000).toISOString() });
  });

  it("unterscheidet 401, 403, 451 und 5xx", async () => {
    expect(await code(new GitHubHttp({ limits: limits(), transport: seq([res(401)]).transport }).getJson("/repos/a/b"))).toBe("auth_config");
    expect(await code(new GitHubHttp({ limits: limits(), transport: seq([res(403)]).transport }).getJson("/repos/a/b"))).toBe("access_blocked");
    expect(await code(new GitHubHttp({ limits: limits(), transport: seq([res(451)]).transport }).getJson("/repos/a/b"))).toBe("access_blocked");
    const fivexx = seq([res(502)]);
    expect(await code(new GitHubHttp({ limits: limits({ maxRetries: 2 }), transport: fivexx.transport, sleep: async () => {} }).getJson("/repos/a/b"))).toBe("github_api_error");
    expect(fivexx.calls).toHaveLength(3);
  });

  it("wiederholt nach Netzwerkfehlern begrenzt", async () => {
    const { transport, calls } = seq([new Error("ECONNRESET"), ok({ fine: true })]);
    const r = await new GitHubHttp({ limits: limits(), transport, sleep: async () => {} }).getJson("/repos/a/b");
    expect(r.data).toEqual({ fine: true });
    expect(calls).toHaveLength(2);
  });

  it("liefert 404 als Status statt als Fehler", async () => {
    const r = await new GitHubHttp({ limits: limits(), transport: seq([res(404)]).transport }).getJson("/repos/a/b");
    expect(r).toEqual({ status: 404, data: null });
  });
});

describe("ETag-Cache", () => {
  it("sendet If-None-Match und nutzt bei 304 den Cache", async () => {
    const store = new Map<string, CachedResponse>();
    const cache: EtagCache = { get: (k) => store.get(k), set: (k, v) => void store.set(k, v) };
    const { transport, calls } = seq([ok({ v: 1 }, { etag: '"abc"' }), res(304)]);
    const http = new GitHubHttp({ limits: limits(), transport, cache, token: "test-token" });
    expect((await http.getJson("/repos/a/b")).data).toEqual({ v: 1 });
    expect((await http.getJson("/repos/a/b")).data).toEqual({ v: 1 });
    expect(calls[1]!.headers["If-None-Match"]).toBe('"abc"');
    expect(calls[0]!.headers.Authorization).toBe("Bearer test-token");
    expect(http.stats.notModified).toBe(1);
  });
});
