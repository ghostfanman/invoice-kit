// Gemeinsame HTTP-Hilfen für Route-Handler: JSON ohne Caching, noindex, Größenlimit für Anfragen.

import type { ServiceResult } from "./service";
import { MAX_BODY_BYTES } from "./service";

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...(status === 204 ? {} : { "Content-Type": "application/json; charset=utf-8" }), ...extra },
  });
}

export function fromResult<T>(r: ServiceResult<T>, map: (b: T) => unknown = (b) => b): Response {
  if (r.ok) return json(r.status, map(r.body));
  return json(r.status, { error: r.error, detail: r.detail }, r.retryAfter ? { "Retry-After": String(r.retryAfter) } : {});
}

export async function readJsonBody(req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return { ok: false, response: json(415, { error: "invalid_request" }) };
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, response: json(413, { error: "invalid_request" }) };
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: json(413, { error: "invalid_request" }) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: json(400, { error: "invalid_request" }) };
  }
}

/** Schutz gegen Cross-Site-Anfragen: schreibende Aufrufe nur von derselben Origin. */
export function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
