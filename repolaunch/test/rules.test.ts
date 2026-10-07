import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyProject } from "@/core/analysis/classify";
import { applyRuleOverrides, DEFAULT_RULE_CONFIG, RULESET_VERSION } from "@/core/rules/config";
import { RULES } from "@/core/rules/definitions";
import { runAudit } from "@/core/rules/engine";
import type { Goal, ProjectType, RepoSnapshot } from "@/core/types";
import { cloneFixture, fixtureSnapshot, NOW, user } from "./helpers";

function finding(audit: ReturnType<typeof runAudit>, ruleId: string) {
  return audit.findings.find((f) => f.ruleId === ruleId)!;
}

function audit(s: RepoSnapshot, goal: Goal = "users", projectTypeOverride?: ProjectType) {
  return runAudit(s, { ...user(goal), projectTypeOverride }, { now: NOW });
}

describe("Projekttyp-Erkennung", () => {
  it.each([
    ["cli-tool", "cli"],
    ["web-app", "webapp"],
    ["library", "library"],
  ])("%s wird als %s erkannt, mit Begründungen", async (name, type) => {
    const c = classifyProject(await fixtureSnapshot(name));
    expect(c.detected).toBe(type);
    expect(c.signals.length).toBeGreaterThan(0);
  });

  it("übernimmt eine Nutzerangabe als Überschreibung und kennzeichnet sie", async () => {
    const c = classifyProject(await fixtureSnapshot("cli-tool"), "library");
    expect(c).toMatchObject({ detected: "cli", used: "library", overridden: true });
  });
});

describe("Projekttypabhängige Gewichtung", () => {
  it("fehlender Screenshot: bei CLI niedrig, bei Webprodukt hoch, bei Bibliothek nicht relevant", async () => {
    const noVisual = (name: string) =>
      cloneFixture(name, (f) => {
        f.readme = { path: "README.md", text: "# x\n\nNo images here at all, just a plain description of the project.\n" };
      });
    const cli = audit(await fixtureSnapshot("cli-tool", "users", noVisual("cli-tool")));
    const web = audit(await fixtureSnapshot("web-app", "users", noVisual("web-app")));
    const lib = audit(await fixtureSnapshot("library", "users", noVisual("library")));
    expect(finding(cli, "usability.visual_demo")).toMatchObject({ status: "missing", severity: "low" });
    expect(finding(web, "usability.visual_demo")).toMatchObject({ status: "missing", severity: "high" });
    expect(finding(lib, "usability.visual_demo")).toMatchObject({ status: "not_relevant", severity: "none" });
  });

  it("fehlender Zahlungslink wertet ehrenamtliche Projekte nicht ab", async () => {
    const s = await fixtureSnapshot("library");
    expect(finding(audit(s, "users"), "distribution.funding").status).toBe("not_relevant");
    expect(finding(audit(s, "contributors"), "distribution.funding").status).toBe("not_relevant");
    const sponsors = finding(audit(s, "sponsors"), "distribution.funding");
    expect(sponsors).toMatchObject({ status: "missing", severity: "high" });
  });

  it("Ziel steuert Relevanz von Angebot und Beitragsregeln", async () => {
    const s = await fixtureSnapshot("web-app");
    expect(finding(audit(s, "users"), "distribution.commercial_offer").status).toBe("not_relevant");
    expect(finding(audit(s, "saas_customers"), "distribution.commercial_offer").severity).toBe("high");
    expect(finding(audit(s, "users"), "trust.contributing").severity).toBe("low");
    expect(finding(audit(s, "contributors"), "trust.contributing").severity).toBe("high");
  });

  it("Regelwerk ist versioniert und jede Regel konfiguriert", () => {
    expect(RULESET_VERSION).toMatch(/^\d{4}\.\d{1,2}\.\d+$/);
    for (const r of RULES) expect(DEFAULT_RULE_CONFIG.rules[r.id], r.id).toBeDefined();
  });

  it("Überschreibungen werden validiert und ändern die Version", async () => {
    const cfg = applyRuleOverrides(DEFAULT_RULE_CONFIG, { version: "team", rules: { "distribution.topics": { enabled: false }, "usability.visual_demo": { weights: { cli: 3 } } } });
    expect(cfg.version).toMatch(/^2026\.10\.0\+team\.[0-9a-f]{8}$/);
    const a = runAudit(await fixtureSnapshot("cli-tool"), user(), { config: cfg, now: NOW });
    expect(finding(a, "distribution.topics")).toMatchObject({ status: "not_relevant" });
    expect(finding(a, "usability.visual_demo").severity).toBe("high");
    expect(() => applyRuleOverrides(DEFAULT_RULE_CONFIG, { rules: { "unknown.rule": { enabled: false } } })).toThrow();
    expect(() => applyRuleOverrides(DEFAULT_RULE_CONFIG, { rules: { "distribution.topics": { weights: { cli: 9 } } } })).toThrow();
  });

  it("die mitgelieferte rules.example.json ist gültig", () => {
    const cfg = applyRuleOverrides(DEFAULT_RULE_CONFIG, JSON.parse(readFileSync("rules.example.json", "utf8")));
    expect(cfg.rules["trust.code_of_conduct"]!.enabled).toBe(false);
  });
});

describe("Befunde mit Belegen", () => {
  it("jeder Befund hat ID, Kategorie, Schwere, Evidenz, Begründung; fehlende auch Aufgabe, Aufwand, Hypothese", async () => {
    const a = audit(await fixtureSnapshot("web-app"));
    for (const f of a.findings.filter((x) => x.status === "missing")) {
      expect(f.id).toMatch(/^[a-z]+\.[a-z_]+@\d+$/);
      expect(f.evidence.length, f.id).toBeGreaterThan(0);
      expect(f.rationale.length).toBeGreaterThan(10);
      expect(f.task, f.id).toBeTruthy();
      expect(f.effort).toMatch(/bis/);
      expect(f.impactHypothesis).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(f.severity);
    }
  });

  it("README-Belege verweisen auf Datei, Zeilen und Commit", async () => {
    const a = audit(await fixtureSnapshot("cli-tool"));
    const ev = finding(a, "usability.quickstart").evidence[0]!;
    expect(ev).toMatchObject({ kind: "file", path: "README.md" });
    expect(ev.url).toContain(`/blob/${"1".repeat(40)}/README.md#L`);
    expect(ev.snippet).toContain("Installation");
  });

  it("liefert fünf priorisierte Aufgaben, sortiert nach Gewicht", async () => {
    const a = audit(await fixtureSnapshot("web-app", "saas_customers"), "saas_customers");
    expect(a.tasks).toHaveLength(5);
    const weights = a.tasks.map((t) => a.findings.find((f) => f.id === t.findingId)!.weight);
    expect([...weights].sort((x, y) => y - x)).toEqual(weights);
  });

  it("bündelt README-Aufgaben, wenn die README fehlt", async () => {
    const s = await fixtureSnapshot("cli-tool", "users", cloneFixture("cli-tool", (f) => delete f.readme));
    const a = audit(s);
    expect(finding(a, "understanding.readme").task).toContain("Enthalten sein sollten");
    expect(finding(a, "usability.quickstart")).toMatchObject({ status: "missing", task: null });
    expect(a.tasks.filter((t) => t.findingId.startsWith("usability.quickstart"))).toHaveLength(0);
  });
});

describe("Unbekannte Daten und Score", () => {
  it("unlesbare README führt zu unbekannt statt fehlt und senkt die Abdeckung", async () => {
    const s = await fixtureSnapshot("cli-tool");
    s.readme = { state: "unknown", path: "README.md", reason: { de: "Test", en: "test" } };
    const a = audit(s);
    expect(finding(a, "usability.quickstart").status).toBe("unknown");
    expect(a.score.coverage).toBeLessThan(1);
    expect(a.score.excluded.some((x) => x.ruleId === "usability.quickstart" && x.status === "unknown")).toBe(true);
  });

  it("Score entspricht der dokumentierten Formel", async () => {
    const a = audit(await fixtureSnapshot("cli-tool"));
    const scored = a.findings.filter((f) => f.status === "present" || f.status === "missing");
    const achieved = scored.filter((f) => f.status === "present").reduce((n, f) => n + f.weight, 0);
    const possible = scored.reduce((n, f) => n + f.weight, 0);
    expect(a.score.value).toBe(Math.round((achieved / possible) * 100));
    expect(a.score.formula).toContain(`${achieved} / ${possible}`);
  });

  it("Sterne beeinflussen weder Score noch Monetarisierung", async () => {
    const s = await fixtureSnapshot("library");
    const a1 = audit(s);
    s.display.stars = 999_999;
    const a2 = audit(s);
    expect(a2.score).toEqual(a1.score);
    expect(a2.monetization).toEqual(a1.monetization);
  });

  it("Monetarisierung: kein Geschäftsmodell nötig beim Ziel Nutzer, Lizenz ohne Rechtsberatung", async () => {
    const a = audit(await fixtureSnapshot("cli-tool"));
    expect(a.monetization.required).toBe(false);
    expect(a.monetization.licenseNote).toContain("Keine Rechtsberatung");
    expect(a.monetization.options.every((o) => o.priceHypothesis.includes("Testhypothese"))).toBe(true);
    expect(a.monetization.disclaimers.join(" ")).toContain("GitHub Sponsors setzt Teilnahmeberechtigung");
  });

  it("30-Tage-Plan hat höchstens zehn Aufgaben", async () => {
    const a = audit(await fixtureSnapshot("web-app"));
    expect(a.launchPlan.tasks.length).toBeLessThanOrEqual(10);
    expect(a.launchPlan.tasks.every((x) => x.week >= 1 && x.week <= 4)).toBe(true);
  });

  it("englischer Bericht enthält englische Texte", async () => {
    const a = runAudit(await fixtureSnapshot("web-app"), user("users", "en"), { now: NOW });
    expect(finding(a, "understanding.description").title).toBe("Meaningful repository description");
    expect(finding(a, "understanding.description").evidence[0]!.label).toBe("GitHub API: description");
    expect(a.score.formula).toMatch(/^Score = sum/);
  });
});
