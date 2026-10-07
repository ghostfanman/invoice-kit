// Orchestriert das optionale KI-Launch-Paket: Offenlegung, Budget, Anfrage, Schemaprüfung,
// Bereinigung und Prüfung gegen den gelesenen Stand.

import { readManifests } from "../analysis/manifests";
import { sanitizeMarkdown, sanitizePlain } from "../security/sanitize";
import type { AuditResult, RepoSnapshot, UserContext } from "../types";
import { buildAiPayload, type AiPayload } from "./payload";
import { buildOutputSchema, type AiOutput } from "./schema";
import { LlmError, type AiCost, type AiDisclosure, type AiLimits, type AiSection, type LlmProvider, type LlmUsage, type Pricing, type VerificationNote } from "./types";
import { verifyMarkdown, verifyPlainText, type VerifyContext } from "./verify";
import { ANTHROPIC_PRICING } from "./anthropic";

export interface AiPackageResult {
  schemaVersion: 1;
  providerId: LlmProvider["id"];
  provider: string;
  model: string;
  isTestAdapter: boolean;
  createdAt: string;
  sections: AiSection[];
  output: AiOutput;
  /** README-Entwurf mit Markierungen ungeprüfter Befehle. */
  readmeAnnotated: string | null;
  checks: VerificationNote[];
  cost: AiCost;
  disclosure: AiDisclosure;
  sanitizerChanges: number;
}

/** Konservative Schätzung: eher zu viele als zu wenige Token. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 3);
}

function costOf(tokensIn: number, tokensOut: number, p: Pricing): number {
  return (tokensIn * p.inputPerMTok + tokensOut * p.outputPerMTok) / 1_000_000;
}

export function planBudget(provider: LlmProvider, payload: AiPayload, limits: AiLimits): { maxOutputTokens: number; worstCaseUsd: number } {
  if (!provider.pricing) throw new LlmError("budget_exceeded", "Kein Preis für dieses Modell hinterlegt; das Kostenbudget ist nicht prüfbar.");
  const inTok = estimateTokens(payload.system.length + payload.user.length);
  const worst = (out: number) => costOf(inTok, out, provider.pricing!) + (provider.fallbackPricing ? costOf(inTok, out, provider.fallbackPricing) : 0);
  let maxOut = limits.maxOutputTokens;
  if (worst(maxOut) > limits.maxCostUsd) {
    const inCost = costOf(inTok, 0, provider.pricing) + (provider.fallbackPricing ? costOf(inTok, 0, provider.fallbackPricing) : 0);
    const perOut = (provider.pricing.outputPerMTok + (provider.fallbackPricing?.outputPerMTok ?? 0)) / 1_000_000;
    maxOut = Math.floor((limits.maxCostUsd - inCost) / perOut);
    if (maxOut < 4000) throw new LlmError("budget_exceeded", "Das Kostenbudget reicht für diesen Auftrag nicht aus.");
  }
  return { maxOutputTokens: maxOut, worstCaseUsd: Math.round(worst(maxOut) * 10_000) / 10_000 };
}

export function buildDisclosure(provider: LlmProvider, payload: AiPayload, limits: AiLimits): AiDisclosure {
  let worstCaseCostUsd: number | null = null;
  try {
    worstCaseCostUsd = planBudget(provider, payload, limits).worstCaseUsd;
  } catch {
    worstCaseCostUsd = null;
  }
  return {
    provider: provider.displayName,
    model: provider.model,
    endpointHost: provider.endpointHost,
    items: payload.items,
    totalChars: payload.totalChars,
    redactedLines: payload.redactedLines,
    limits,
    worstCaseCostUsd,
    isTestAdapter: provider.id === "fake",
  };
}

function computeCost(usage: LlmUsage, provider: LlmProvider): AiCost {
  const p = provider.pricing;
  if (!p) return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedUsd: null, note: { de: "Kein Preis hinterlegt.", en: "No price configured." } };
  let usd = 0;
  let inTok = 0;
  let outTok = 0;
  if (usage.iterations && usage.iterations.length > 0) {
    for (const it of usage.iterations) {
      const price = (it.model && ANTHROPIC_PRICING[it.model]) || (it.type === "fallback_message" ? provider.fallbackPricing ?? p : p);
      usd += costOf(it.inputTokens, it.outputTokens, price);
      inTok += it.inputTokens;
      outTok += it.outputTokens;
    }
  } else {
    usd = costOf(usage.inputTokens, usage.outputTokens, p);
    inTok = usage.inputTokens;
    outTok = usage.outputTokens;
  }
  return {
    inputTokens: inTok,
    outputTokens: outTok,
    estimatedUsd: Math.round(usd * 10_000) / 10_000,
    note: { de: "Schätzung anhand von Listenpreisen; maßgeblich ist die Abrechnung des Anbieters.", en: "Estimate based on list prices; the provider's billing is authoritative." },
  };
}

function verifyContext(snapshot: RepoSnapshot, user: UserContext): VerifyContext {
  let homepageHost: string | null = null;
  try {
    homepageHost = snapshot.meta.homepage ? new URL(snapshot.meta.homepage).hostname.toLowerCase() : null;
  } catch {
    homepageHost = null;
  }
  const readmeText = snapshot.readme.state === "present" ? snapshot.readme.text : "";
  return {
    owner: snapshot.owner,
    repo: snapshot.repo,
    readmeText,
    sourceText: [readmeText, snapshot.meta.description ?? "", user.audience ?? "", user.knownFeatures ?? ""].join("\n"),
    manifests: readManifests(snapshot),
    treePaths: snapshot.tree.entries.map((e) => e.path),
    scannedDirs: snapshot.tree.scannedDirs,
    homepageHost,
  };
}

export interface AiRunInput {
  provider: LlmProvider;
  snapshot: RepoSnapshot;
  audit: AuditResult;
  user: UserContext;
  sections: AiSection[];
  limits: AiLimits;
  /** Geheimnisse aus der Serverkonfiguration, die nie in Ausgaben erscheinen dürfen. */
  secrets: string[];
  now?: () => Date;
}

export async function runAiPackage(input: AiRunInput): Promise<AiPackageResult> {
  const { provider, snapshot, audit, user, limits, secrets } = input;
  const sections = [...new Set(input.sections)];
  if (sections.length === 0) throw new LlmError("invalid_output", "Keine Abschnitte gewählt.");
  const payload = buildAiPayload(snapshot, audit, user, sections, limits);
  const disclosure = buildDisclosure(provider, payload, limits);
  const budget = planBudget(provider, payload, limits);
  const schema = buildOutputSchema(sections);

  const res = await provider.generate({
    system: payload.system,
    user: payload.user,
    schema,
    maxOutputTokens: budget.maxOutputTokens,
    timeoutMs: limits.timeoutMs,
  });

  // Unabhängig vom Anbieter erneut gegen das strikte Schema prüfen.
  const parsed = schema.safeParse(res.data);
  if (!parsed.success) throw new LlmError("invalid_output", "Die KI-Ausgabe entspricht nicht dem erwarteten Schema.");
  const raw = parsed.data;

  let changes = 0;
  const md = (s: string) => {
    const r = sanitizeMarkdown(s, secrets);
    changes += r.changes;
    return r.text;
  };
  const plain = (s: string) => {
    const r = sanitizeMarkdown(s, secrets);
    changes += r.changes;
    return sanitizePlain(r.text, secrets);
  };
  const output: AiOutput = {
    openQuestions: raw.openQuestions.map(plain),
    userProvidedFactsUsed: raw.userProvidedFactsUsed.map(plain),
  };
  if (raw.readme) output.readme = { markdown: md(raw.readme.markdown), notes: raw.readme.notes.map(plain) };
  if (raw.descriptionTopics) output.descriptionTopics = { description: plain(raw.descriptionTopics.description), topics: raw.descriptionTopics.topics, rationale: plain(raw.descriptionTopics.rationale) };
  if (raw.plan30) output.plan30 = { tasks: raw.plan30.tasks.map((t) => ({ ...t, title: plain(t.title), why: plain(t.why), effort: plain(t.effort), findingIds: t.findingIds.map(plain) })) };
  if (raw.launchTexts) output.launchTexts = { linkedin: plain(raw.launchTexts.linkedin), community: { name: plain(raw.launchTexts.community.name), text: plain(raw.launchTexts.community.text) }, releaseAnnouncement: plain(raw.launchTexts.releaseAnnouncement) };
  if (raw.monetization) output.monetization = { options: raw.monetization.options.map((o) => ({ ...o, title: plain(o.title), whoPays: plain(o.whoPays), forWhat: plain(o.forWhat), prerequisites: o.prerequisites.map(plain), effort: plain(o.effort), targetCustomers: plain(o.targetCustomers), priceHypothesis: plain(o.priceHypothesis) })) };
  if (raw.landingPage) output.landingPage = { markdown: md(raw.landingPage.markdown) };

  const ctx = verifyContext(snapshot, user);
  const checks: VerificationNote[] = [];
  let readmeAnnotated: string | null = null;
  if (output.readme) {
    const v = verifyMarkdown("readme", output.readme.markdown, ctx, user.language);
    checks.push(...v.notes);
    readmeAnnotated = v.annotated;
  }
  if (output.landingPage) checks.push(...verifyMarkdown("landingPage", output.landingPage.markdown, ctx, user.language).notes);
  if (output.launchTexts) {
    checks.push(...verifyPlainText("launchTexts", [output.launchTexts.linkedin, output.launchTexts.community.text, output.launchTexts.releaseAnnouncement].join("\n"), ctx));
  }
  if (output.descriptionTopics) checks.push(...verifyPlainText("descriptionTopics", output.descriptionTopics.description, ctx));
  if (output.plan30) {
    const known = new Set(audit.findings.map((f) => f.id));
    for (const t of output.plan30.tasks) {
      for (const id of t.findingIds) {
        if (!known.has(id)) checks.push({ section: "plan30", kind: "claim", value: id, status: "unverified", reason: { de: "Unbekannte Befund-ID.", en: "Unknown finding id." } });
      }
    }
  }

  return {
    schemaVersion: 1,
    providerId: provider.id,
    provider: provider.displayName,
    model: res.model,
    isTestAdapter: provider.id === "fake",
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    sections,
    output,
    readmeAnnotated,
    checks,
    cost: computeCost(res.usage, provider),
    disclosure,
    sanitizerChanges: changes,
  };
}
