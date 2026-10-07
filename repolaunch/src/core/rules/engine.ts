// Führt alle Regeln aus, berechnet den internen Bereitschaftsscore und priorisiert fünf Aufgaben.

import { classifyProject } from "../analysis/classify";
import { readManifests } from "../analysis/manifests";
import { parseMarkdown } from "../analysis/markdown";
import { formatEffort } from "../format";
import { buildLaunchPlan } from "../launch-plan";
import { assessMonetization } from "../monetization";
import { detectInjection } from "../security/injection";
import { t } from "@/i18n/messages";
import type { AuditResult, Category, Finding, PrioritizedTask, ReadinessScore, RepoSnapshot, Severity, UserContext } from "../types";
import { DEFAULT_RULE_CONFIG, effectiveWeight, type RuleConfig } from "./config";
import { RULES, type RuleContext } from "./definitions";

const CATEGORY_ORDER: Category[] = ["understanding", "usability", "trust", "distribution"];

export function severityForWeight(weight: number): Severity {
  if (weight >= 3) return "high";
  if (weight === 2) return "medium";
  if (weight === 1) return "low";
  return "none";
}

export interface AuditOptions {
  config?: RuleConfig;
  now?: Date;
}

export function runAudit(snapshot: RepoSnapshot, user: UserContext, opts: AuditOptions = {}): AuditResult {
  const config = opts.config ?? DEFAULT_RULE_CONFIG;
  const now = opts.now ?? new Date();
  const lang = user.language;
  const classification = classifyProject(snapshot, user.projectTypeOverride);
  const readme = snapshot.readme.state === "present" ? parseMarkdown(snapshot.readme.text) : null;
  const ctx: RuleContext = {
    snapshot,
    user,
    projectType: classification.used,
    readme,
    readmePath: snapshot.readme.state === "present" ? snapshot.readme.path : null,
    manifests: readManifests(snapshot),
    now,
    lang,
  };
  const readmeMissing = snapshot.readme.state === "missing";

  const findings: Finding[] = [];
  for (const rule of RULES) {
    const cfg = config.rules[rule.id];
    const base = {
      id: `${rule.id}@${rule.version}`,
      ruleId: rule.id,
      ruleVersion: rule.version,
      category: rule.category,
      title: rule.title[lang],
      rationale: rule.rationale[lang],
    };
    if (!cfg || !cfg.enabled) {
      findings.push({
        ...base,
        status: "not_relevant",
        severity: "none",
        weight: 0,
        evidence: [],
        task: null,
        effort: null,
        effortMinutes: null,
        impactHypothesis: null,
        exclusionReason: lang === "de" ? "Per Konfiguration deaktiviert." : "Disabled by configuration.",
      });
      continue;
    }
    const weight = effectiveWeight(cfg, classification.used, user.goal);
    if (weight === 0) {
      findings.push({
        ...base,
        status: "not_relevant",
        severity: "none",
        weight: 0,
        evidence: [],
        task: null,
        effort: null,
        effortMinutes: null,
        impactHypothesis: null,
        exclusionReason:
          lang === "de"
            ? `Für Projekttyp "${t(lang).projectTypes[classification.used]}" und Ziel "${t(lang).goals[user.goal]}" nicht relevant (Gewicht 0).`
            : `Not relevant for project type "${t(lang).projectTypes[classification.used]}" and goal "${t(lang).goals[user.goal]}" (weight 0).`,
      });
      continue;
    }
    const outcome = rule.evaluate(ctx);
    const status = outcome.status;
    const bundled = status === "missing" && rule.readmeContent && readmeMissing;
    findings.push({
      ...base,
      status,
      severity: status === "missing" ? severityForWeight(weight) : "none",
      weight: status === "not_relevant" ? 0 : weight,
      rationale: outcome.note ? `${base.rationale} ${outcome.note[lang]}` : base.rationale,
      evidence: outcome.evidence,
      task: status === "missing" && !bundled ? rule.task[lang] : null,
      effort: status === "missing" ? formatEffort(rule.effortMinutes, lang) : null,
      effortMinutes: status === "missing" ? rule.effortMinutes : null,
      impactHypothesis: status === "missing" ? rule.impact[lang] : null,
      exclusionReason:
        status === "unknown"
          ? outcome.note?.[lang] ?? (lang === "de" ? "Daten nicht verfügbar." : "Data not available.")
          : status === "not_relevant"
            ? outcome.note?.[lang]
            : bundled
              ? lang === "de" ? "In der Aufgabe \"README anlegen\" enthalten." : "Included in the task \"Create a README\"."
              : undefined,
    });
  }

  // Fehlt die README, werden die README-Inhaltsregeln in einer Aufgabe gebündelt.
  if (readmeMissing) {
    const readmeFinding = findings.find((f) => f.ruleId === "understanding.readme");
    const bundledTitles = findings.filter((f) => f.status === "missing" && f.task === null && f.exclusionReason && f.ruleId !== "understanding.readme").map((f) => f.title);
    if (readmeFinding && readmeFinding.task && bundledTitles.length > 0) {
      readmeFinding.task += lang === "de" ? ` Enthalten sein sollten: ${bundledTitles.join("; ")}.` : ` It should include: ${bundledTitles.join("; ")}.`;
    }
  }

  const tasks = prioritize(findings);
  const score = computeScore(findings, lang);
  return {
    schemaVersion: 1,
    rulesetVersion: config.version,
    generatedAt: now.toISOString(),
    classification,
    findings,
    tasks,
    score,
    monetization: assessMonetization(snapshot, user, classification.used, findings),
    launchPlan: buildLaunchPlan(findings, tasks, user, snapshot),
    injectionFlags: detectInjection(snapshot),
  };
}

export function prioritize(findings: Finding[]): PrioritizedTask[] {
  const ruleOrder = new Map(RULES.map((r, i) => [r.id, i]));
  return findings
    .filter((f) => f.status === "missing" && f.task && f.effortMinutes)
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.effortMinutes![0] - b.effortMinutes![0] ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        (ruleOrder.get(a.ruleId) ?? 0) - (ruleOrder.get(b.ruleId) ?? 0),
    )
    .slice(0, 5)
    .map((f, i) => ({
      rank: i + 1,
      findingId: f.id,
      title: f.title,
      task: f.task!,
      severity: f.severity,
      effort: f.effort!,
      impactHypothesis: f.impactHypothesis!,
    }));
}

export function computeScore(findings: Finding[], lang: "de" | "en"): ReadinessScore {
  let achieved = 0;
  let possible = 0;
  let unknownWeight = 0;
  const byCategory = CATEGORY_ORDER.map((category) => ({ category, achieved: 0, possible: 0, unknownWeight: 0 }));
  const excluded: ReadinessScore["excluded"] = [];
  for (const f of findings) {
    const cat = byCategory.find((c) => c.category === f.category)!;
    if (f.status === "present" || f.status === "missing") {
      possible += f.weight;
      cat.possible += f.weight;
      if (f.status === "present") {
        achieved += f.weight;
        cat.achieved += f.weight;
      }
    } else {
      if (f.status === "unknown") {
        unknownWeight += f.weight;
        cat.unknownWeight += f.weight;
      }
      excluded.push({ ruleId: f.ruleId, status: f.status, reason: f.exclusionReason ?? "" });
    }
  }
  const relevant = possible + unknownWeight;
  return {
    value: possible > 0 ? Math.round((achieved / possible) * 100) : null,
    achievedWeight: achieved,
    possibleWeight: possible,
    unknownWeight,
    coverage: relevant > 0 ? possible / relevant : 0,
    byCategory,
    excluded,
    formula:
      lang === "de"
        ? `Score = Summe der Gewichte erfüllter Regeln / Summe der Gewichte bewerteter Regeln × 100 = ${achieved} / ${possible} × 100. Unbekannte und nicht relevante Regeln zählen nicht. Abdeckung = bewertete Gewichte / (bewertete + unbekannte Gewichte) = ${possible} / ${relevant}.`
        : `Score = sum of weights of met rules / sum of weights of scored rules × 100 = ${achieved} / ${possible} × 100. Unknown and not relevant rules do not count. Coverage = scored weights / (scored + unknown weights) = ${possible} / ${relevant}.`,
  };
}
