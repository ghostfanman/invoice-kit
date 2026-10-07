import { describe, expect, it } from "vitest";
import { openDb } from "@/server/db";
import { AiLimitError, hashKey, JobStore, QueueFullError, type JobInput } from "@/server/jobs";
import { clientKey, FixedWindowLimiter } from "@/server/rate-limit";

const input: JobInput = { source: "github", owner: "a", repo: "b", user: { goal: "users", language: "de" } };

function store(now: { t: number }) {
  return new JobStore(openDb(":memory:"), () => new Date(now.t));
}

describe("Auftragsspeicher", () => {
  it("erzeugt hochentropische Schlüssel und speichert nur deren Hash", () => {
    const clock = { t: Date.parse("2026-10-07T12:00:00Z") };
    const s = store(clock);
    const { id, key } = s.create(input, 72, 10);
    expect(id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = s.getById(id)!;
    expect(row.key_hash).toBe(hashKey(id, key));
    expect(JSON.stringify(row)).not.toContain(key);
    expect(s.getAuthorized(id, key)?.id).toBe(id);
    expect(s.getAuthorized(id, key.slice(0, -1) + (key.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(s.getAuthorized(id, "short")).toBeNull();
    expect(s.getAuthorized("../../etc", key)).toBeNull();
  });

  it("begrenzt aktive Aufträge", () => {
    const s = store({ t: Date.now() });
    s.create(input, 72, 2);
    s.create(input, 72, 2);
    expect(() => s.create(input, 72, 2)).toThrow(QueueFullError);
  });

  it("läuft nach TTL ab und wird gelöscht", () => {
    const clock = { t: Date.parse("2026-10-07T12:00:00Z") };
    const s = store(clock);
    const { id, key } = s.create(input, 1, 10);
    clock.t += 2 * 3_600_000;
    expect(s.getAuthorized(id, key)).toBeNull();
    expect(s.purgeExpired().jobs).toBe(1);
    expect(s.getById(id)).toBeNull();
  });

  it("verarbeitet in Reihenfolge und nimmt nach Neustart nachvollziehbar wieder auf", () => {
    const clock = { t: Date.parse("2026-10-07T12:00:00Z") };
    const s = store(clock);
    const a = s.create(input, 72, 10);
    clock.t += 1000;
    s.create(input, 72, 10);
    const first = s.claimNext()!;
    expect(first.row.id).toBe(a.id);
    // Absturz simulieren: kein Herzschlag mehr
    clock.t += 120_000;
    expect(s.recoverStale(60_000, 2)).toEqual({ requeued: 1, failed: 0 });
    expect(s.getById(a.id)!.status).toBe("queued");
    s.claimNext();
    clock.t += 120_000;
    expect(s.recoverStale(60_000, 2)).toEqual({ requeued: 0, failed: 1 });
    expect(s.getById(a.id)).toMatchObject({ status: "failed", error_code: "interrupted" });
    expect(s.events(a.id).map((e) => e.type)).toEqual(["created", "started", "resumed", "started", "failed"]);
  });

  it("begrenzt KI-Durchläufe pro Auftrag", () => {
    const s = store({ t: Date.now() });
    const { id } = s.create(input, 72, 10);
    expect(() => s.requestAi(id, { sections: ["readme"], consentAt: "x", provider: "p", model: "m" }, 1)).toThrow("not_ready");
    s.claimNext();
    s.completeAudit(id, { commitSha: "a".repeat(40), analyzedAt: "x" } as never, { rulesetVersion: "v" } as never);
    s.requestAi(id, { sections: ["readme"], consentAt: "x", provider: "p", model: "m" }, 1);
    s.claimNext();
    s.failAi(id, "timeout");
    expect(() => s.requestAi(id, { sections: ["readme"], consentAt: "x", provider: "p", model: "m" }, 1)).toThrow(AiLimitError);
  });

  it("Löschen entfernt Auftrag und Ereignisse", () => {
    const db = openDb(":memory:");
    const s = new JobStore(db);
    const { id } = s.create(input, 72, 10);
    expect(s.delete(id)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM job_events WHERE job_id = ?").get(id)).toEqual({ n: 0 });
  });
});

describe("Ratenbegrenzung und Proxy-Konfiguration", () => {
  it("Fixed Window zählt pro Schlüssel und gibt Retry-After", () => {
    let t = 0;
    const l = new FixedWindowLimiter(2, 1000, () => t);
    expect(l.take("a").allowed).toBe(true);
    expect(l.take("a").allowed).toBe(true);
    expect(l.take("a")).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(l.take("b").allowed).toBe(true);
    t = 1000;
    expect(l.take("a").allowed).toBe(true);
  });

  it("vertraut X-Forwarded-For nur mit konfigurierten Proxy-Hops", () => {
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" });
    expect(clientKey(h, 0)).toBe("global");
    expect(clientKey(h, 1)).toBe("203.0.113.7");
    expect(clientKey(h, 2)).toBe("6.6.6.6");
    expect(clientKey(new Headers({ "x-forwarded-for": "<script>" }), 1)).toBe("global");
  });
});
