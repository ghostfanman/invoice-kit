// Vollständiger Ablauf URL -> Auftrag -> Audit -> Bericht -> KI (Testadapter) -> Export mit reproduzierbaren Fixtures.
// Die "github"-Quelle läuft über denselben Client wie live, nur mit einem Fixture-Transport.

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { FakeProvider } from "@/core/ai/fake";
import { fixtureTransport } from "@/core/github/fixture-transport";
import { DEFAULT_RULE_CONFIG } from "@/core/rules/config";
import { DEFAULT_AI_LIMITS } from "@/core/ai/types";
import { FIXTURE_REPOS } from "@/fixtures/repos";
import { createApp, type App } from "@/server/app";
import type { ServerConfig } from "@/server/config";
import { openDb } from "@/server/db";
import { createJob, deleteJob, exportJob, getJobView, requestAi } from "@/server/service";

function config(over: Partial<ServerConfig> = {}): ServerConfig {
  return {
    dataDir: ":memory:",
    dbFile: ":memory:",
    demoMode: false,
    jobTtlHours: 72,
    maxActiveJobs: 20,
    maxJobAttempts: 3,
    rateLimitJobsPerHour: 100,
    rateLimitAiPerHour: 100,
    rateLimitReadsPerMinute: 1000,
    trustProxyHops: 0,
    ai: { provider: "fake", limits: DEFAULT_AI_LIMITS },
    rules: DEFAULT_RULE_CONFIG,
    ...over,
  };
}

function app(over: Partial<ServerConfig> = {}, provider: FakeProvider | null = new FakeProvider("ok")): App {
  return createApp(config(over), { db: openDb(":memory:"), provider, transport: fixtureTransport(FIXTURE_REPOS) });
}

const auth = (key: string) => new Headers({ authorization: `Bearer ${key}` });

async function createAndRun(a: App, body: Record<string, unknown>) {
  const created = createJob(a, body, new Headers());
  if (!created.ok) throw new Error(created.error);
  expect(await a.worker.runOnce()).toBe(true);
  return created.body;
}

describe("URL-zu-Bericht-Ablauf", () => {
  it("analysiert ohne Schreibrechte, liefert fünf belegte Aufgaben und gültige Exporte", async () => {
    const a = app();
    const { id, key } = await createAndRun(a, { repo: "https://github.com/repolaunch-fixtures/web-app", goal: "saas_customers", language: "de", audience: "Kleine Teams" });

    const view = getJobView(a, id, auth(key));
    expect(view.ok).toBe(true);
    if (!view.ok) return;
    const v = view.body;
    expect(v.status).toBe("done");
    expect(v.snapshot?.commitSha).toBe("2".repeat(40));
    expect(v.audit?.tasks).toHaveLength(5);
    for (const t of v.audit!.tasks) {
      const f = v.audit!.findings.find((x) => x.id === t.findingId)!;
      expect(f.evidence.length).toBeGreaterThan(0);
    }
    expect(v.events.map((e) => e.type)).toEqual(["created", "started", "done"]);
    expect(v.ai.availability.disclosure?.items.length).toBeGreaterThan(0);

    // Export ohne KI: nur tatsächlich erzeugte Dateien, fehlende erklärt
    const ex1 = exportJob(a, id, auth(key));
    expect(ex1.ok).toBe(true);
    if (!ex1.ok) return;
    const files1 = Object.keys(unzipSync(ex1.body.zip)).map((n) => n.split("/")[1]);
    expect(files1.sort()).toEqual(["audit.json", "audit.md", "launch-plan.md", "monetization-plan.md"]);
    const md1 = ex1.body.contents["audit.md"]!;
    expect(md1).toContain("README.suggested.md`: nicht enthalten");
    expect(md1).toContain("marketing-drafts.md`: nicht enthalten");
    const json1 = JSON.parse(ex1.body.contents["audit.json"]!);
    expect(json1.ai).toBeNull();
    expect(json1.export.files.filter((f: { included: boolean }) => !f.included)).toHaveLength(2);
    expect(JSON.stringify(json1)).not.toContain(key);

    // KI nur mit Zustimmung
    expect(requestAi(a, id, { consent: false, sections: ["readme"] }, auth(key))).toMatchObject({ ok: false, error: "consent_required" });
    expect(requestAi(a, id, { sections: ["readme"] }, auth(key))).toMatchObject({ ok: false, error: "consent_required" });
    expect(requestAi(a, id, { consent: true, sections: ["readme", "launchTexts", "monetization", "plan30", "descriptionTopics", "landingPage"] }, auth(key))).toMatchObject({ ok: true, status: 202 });
    expect(await a.worker.runOnce()).toBe(true);
    const after = getJobView(a, id, auth(key));
    expect(after.ok && after.body.ai.status).toBe("done");

    // Export mit KI: alle sechs Dateien, keine Originaldatei überschrieben
    const ex2 = exportJob(a, id, auth(key));
    if (!ex2.ok) throw new Error("export failed");
    const entries = unzipSync(ex2.body.zip);
    const names = Object.keys(entries).map((n) => n.split("/")[1]);
    expect(names.sort()).toEqual(["README.suggested.md", "audit.json", "audit.md", "launch-plan.md", "marketing-drafts.md", "monetization-plan.md"]);
    expect(names).not.toContain("README.md");
    const audit = JSON.parse(strFromU8(Object.entries(entries).find(([n]) => n.endsWith("audit.json"))![1]));
    expect(audit.schemaVersion).toBe(1);
    expect(audit.audit.rulesetVersion).toBe(DEFAULT_RULE_CONFIG.version);
    expect(audit.ai.isTestAdapter).toBe(true);
    expect(audit.repository.readme).not.toHaveProperty("text");
    for (const [, bytes] of Object.entries(entries)) expect(strFromU8(bytes)).not.toMatch(/<script/i);

    // Löschen über den Zugriffsschlüssel
    expect(deleteJob(a, id, auth(key))).toMatchObject({ ok: true, status: 204 });
    expect(getJobView(a, id, auth(key))).toMatchObject({ ok: false, status: 404 });
  });

  it("zeigt ehrliche Fehlerzustände", async () => {
    const a = app();
    const missing = await createAndRun(a, { repo: "repolaunch-fixtures/nope", goal: "users", language: "de" });
    const v = getJobView(a, missing.id, auth(missing.key));
    expect(v.ok && v.body).toMatchObject({ status: "failed", errorCode: "not_found_or_private", audit: null });
    expect(exportJob(a, missing.id, auth(missing.key))).toMatchObject({ ok: false, error: "not_ready" });
  });

  it("prüft Eingaben, Demo-Modus, Schlüssel und Limits serverseitig", () => {
    const a = app({ maxActiveJobs: 1, rateLimitJobsPerHour: 2 });
    expect(createJob(a, { repo: "https://evil.com/a/b", goal: "users", language: "de" }, new Headers())).toMatchObject({ ok: false, status: 400, error: "invalid_repo", detail: "wrong_host" });
    expect(createJob(a, { repo: "a/b", goal: "rich", language: "de" }, new Headers())).toMatchObject({ ok: false, error: "invalid_request" });
    expect(createJob(a, { repo: "a/b", goal: "users", language: "de", extra: 1 }, new Headers())).toMatchObject({ ok: false, error: "invalid_request" });
    expect(createJob(a, { fixture: "cli-tool", goal: "users", language: "de" }, new Headers())).toMatchObject({ ok: false, status: 403, error: "demo_disabled" });
    const first = createJob(a, { repo: "a/b", goal: "users", language: "de" }, new Headers());
    expect(first.ok).toBe(true);
    expect(createJob(a, { repo: "a/c", goal: "users", language: "de" }, new Headers())).toMatchObject({ ok: false, status: 503, error: "queue_full" });
    expect(createJob(a, { repo: "a/d", goal: "users", language: "de" }, new Headers())).toMatchObject({ ok: false, status: 429, error: "rate_limited_client" });
    if (first.ok) {
      expect(getJobView(a, first.body.id, new Headers())).toMatchObject({ ok: false, status: 404 });
      expect(getJobView(a, first.body.id, auth("x".repeat(43)))).toMatchObject({ ok: false, status: 404 });
    }
  });

  it("ohne KI-Schlüssel funktioniert der Audit vollständig, KI wird ehrlich abgelehnt", async () => {
    const a = app({ ai: { provider: "none", limits: DEFAULT_AI_LIMITS } }, null);
    const { id, key } = await createAndRun(a, { repo: "repolaunch-fixtures/cli-tool", goal: "users", language: "en" });
    const v = getJobView(a, id, auth(key));
    expect(v.ok && v.body.status).toBe("done");
    expect(v.ok && v.body.ai.availability).toMatchObject({ configured: false, disclosure: null });
    expect(requestAi(a, id, { consent: true, sections: ["readme"] }, auth(key))).toMatchObject({ ok: false, error: "ai_not_configured" });
    const ex = exportJob(a, id, auth(key));
    expect(ex.ok && ex.body.contents["audit.md"]).toContain("Contents of this export");
  });

  it("KI-Fehler werden am Auftrag gespeichert, der Audit bleibt erhalten", async () => {
    const a = app({}, new FakeProvider("timeout"));
    const { id, key } = await createAndRun(a, { repo: "repolaunch-fixtures/library", goal: "users", language: "de" });
    requestAi(a, id, { consent: true, sections: ["readme"] }, auth(key));
    await a.worker.runOnce();
    const v = getJobView(a, id, auth(key));
    expect(v.ok && v.body).toMatchObject({ status: "done", ai: { status: "failed", errorCode: "timeout" } });
  });

  it("Demo-Fixtures sind nur im Demo-Modus erlaubt und gekennzeichnet", async () => {
    const a = app({ demoMode: true });
    const { id, key } = await createAndRun(a, { fixture: "cli-tool", goal: "users", language: "de" });
    const v = getJobView(a, id, auth(key));
    expect(v.ok && v.body.snapshot?.source).toBe("fixture");
    const ex = exportJob(a, id, auth(key));
    expect(ex.ok && ex.body.contents["audit.md"]).toContain("Demo-Modus");
  });
});
