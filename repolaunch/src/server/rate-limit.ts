// Serverseitige Ratenbegrenzung im Speicher (ein Prozess, siehe docs/architecture.md).

export class FixedWindowLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Liefert true, wenn die Anfrage erlaubt ist, und zählt sie. */
  take(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const t = this.now();
    if (this.buckets.size > 10_000) this.prune(t);
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= t) {
      this.buckets.set(key, { count: 1, resetAt: t + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (b.count >= this.limit) return { allowed: false, retryAfterSeconds: Math.ceil((b.resetAt - t) / 1000) };
    b.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private prune(t: number): void {
    for (const [k, b] of this.buckets) if (b.resetAt <= t) this.buckets.delete(k);
  }
}

/**
 * Ermittelt den Client-Schlüssel. Ohne vertrauenswürdigen Proxy (TRUST_PROXY_HOPS=0) teilen sich alle
 * Clients einen Schlüssel, denn Next.js-Route-Handler kennen die Socket-Adresse nicht und
 * X-Forwarded-For wäre fälschbar. Mit N Proxys wird der N-te Eintrag von rechts verwendet.
 */
export function clientKey(headers: Headers, trustProxyHops: number): string {
  if (trustProxyHops <= 0) return "global";
  const xff = headers.get("x-forwarded-for");
  if (!xff) return "global";
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
  const ip = parts[parts.length - trustProxyHops] ?? parts[0];
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : "global";
}
