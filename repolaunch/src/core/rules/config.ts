// Versionierte, konfigurierbare Gewichtung der Regeln nach Projekttyp und Nutzerziel.
// Gewicht 0 bedeutet "nicht relevant". 3 ist das höchste Gewicht (Schwere "hoch").

import { createHash } from "node:crypto";
import { z } from "zod";
import { GOALS, PROJECT_TYPES, type Goal, type ProjectType } from "../types";

export const RULESET_VERSION = "2026.10.0";

export interface RuleWeightConfig {
  enabled: boolean;
  weights: Record<ProjectType, number>;
  /** Additive Anpassung je Nutzerziel; Ergebnis wird auf 0 bis 3 begrenzt. */
  goalAdjust: Partial<Record<Goal, number>>;
}

export interface RuleConfig {
  version: string;
  rules: Record<string, RuleWeightConfig>;
}

// Reihenfolge der Gewichte: cli, library, webapp, template, other
const w = (cli: number, library: number, webapp: number, template: number, other: number) => ({ cli, library, webapp, template, other });

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  version: RULESET_VERSION,
  rules: {
    "understanding.description": { enabled: true, weights: w(3, 3, 3, 3, 3), goalAdjust: {} },
    "understanding.readme": { enabled: true, weights: w(3, 3, 3, 3, 3), goalAdjust: {} },
    "understanding.intro": { enabled: true, weights: w(2, 2, 2, 2, 2), goalAdjust: {} },
    "understanding.audience": { enabled: true, weights: w(2, 2, 2, 1, 1), goalAdjust: { saas_customers: 1, support_clients: 1 } },
    "understanding.example": { enabled: true, weights: w(3, 3, 1, 1, 2), goalAdjust: {} },
    "usability.quickstart": { enabled: true, weights: w(3, 3, 2, 3, 2), goalAdjust: {} },
    "usability.prerequisites": { enabled: true, weights: w(2, 2, 2, 2, 1), goalAdjust: {} },
    // Screenshot oder Demo: für ein Webprodukt wichtig, für ein CLI nur ein leichter Hinweis, für Bibliotheken nicht relevant.
    "usability.visual_demo": { enabled: true, weights: w(1, 0, 3, 2, 1), goalAdjust: { saas_customers: 1 } },
    "usability.docs": { enabled: true, weights: w(2, 3, 1, 1, 1), goalAdjust: {} },
    "usability.cli_reference": { enabled: true, weights: w(3, 0, 0, 0, 0), goalAdjust: {} },
    "usability.api_reference": { enabled: true, weights: w(0, 3, 0, 0, 0), goalAdjust: {} },
    "usability.template_flag": { enabled: true, weights: w(0, 0, 0, 3, 0), goalAdjust: {} },
    "trust.license": { enabled: true, weights: w(3, 3, 3, 3, 3), goalAdjust: {} },
    "trust.maintenance": { enabled: true, weights: w(2, 3, 2, 2, 2), goalAdjust: { support_clients: 1, saas_customers: 1 } },
    "trust.releases": { enabled: true, weights: w(3, 3, 1, 1, 1), goalAdjust: {} },
    "trust.contributing": { enabled: true, weights: w(1, 1, 1, 1, 1), goalAdjust: { contributors: 2 } },
    "trust.security_policy": { enabled: true, weights: w(2, 2, 2, 1, 1), goalAdjust: { support_clients: 1, saas_customers: 1 } },
    "trust.contact": { enabled: true, weights: w(2, 2, 2, 2, 2), goalAdjust: { support_clients: 1 } },
    "trust.code_of_conduct": { enabled: true, weights: w(0, 0, 0, 0, 0), goalAdjust: { contributors: 1 } },
    "trust.changelog": { enabled: true, weights: w(2, 2, 1, 1, 1), goalAdjust: {} },
    "distribution.topics": { enabled: true, weights: w(2, 2, 2, 2, 2), goalAdjust: {} },
    "distribution.homepage": { enabled: true, weights: w(1, 1, 3, 1, 1), goalAdjust: { saas_customers: 1 } },
    "distribution.next_step": { enabled: true, weights: w(2, 2, 3, 2, 2), goalAdjust: {} },
    "distribution.registry": { enabled: true, weights: w(2, 2, 0, 0, 0), goalAdjust: {} },
    // Finanzierung nur bewerten, wenn der Nutzer Geld als Ziel nennt. Ehrenamtliche Projekte werden nicht abgewertet.
    "distribution.funding": { enabled: true, weights: w(0, 0, 0, 0, 0), goalAdjust: { sponsors: 3, support_clients: 1 } },
    "distribution.commercial_offer": { enabled: true, weights: w(0, 0, 0, 0, 0), goalAdjust: { support_clients: 3, saas_customers: 3 } },
    "distribution.contributor_entry": { enabled: true, weights: w(0, 0, 0, 0, 0), goalAdjust: { contributors: 2 } },
  },
};

const weightSchema = z.number().int().min(0).max(3);
const overrideSchema = z
  .object({
    version: z.string().max(40).optional(),
    rules: z.record(
      z.string().regex(/^[a-z]+\.[a-z_]+$/),
      z
        .object({
          enabled: z.boolean().optional(),
          weights: z.object(Object.fromEntries(PROJECT_TYPES.map((t) => [t, weightSchema.optional()]))).strict().optional(),
          goalAdjust: z.object(Object.fromEntries(GOALS.map((g) => [g, z.number().int().min(-3).max(3).optional()]))).strict().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export type RuleConfigOverride = z.infer<typeof overrideSchema>;

/** Wendet eine validierte Überschreibung an. Unbekannte Regel-IDs werden abgelehnt. */
export function applyRuleOverrides(base: RuleConfig, raw: unknown): RuleConfig {
  const parsed = overrideSchema.parse(raw);
  const rules: Record<string, RuleWeightConfig> = structuredClone(base.rules);
  for (const [id, o] of Object.entries(parsed.rules)) {
    const current = rules[id];
    if (!current) throw new Error(`Unbekannte Regel-ID in Konfiguration: ${id}`);
    if (o.enabled !== undefined) current.enabled = o.enabled;
    for (const t of PROJECT_TYPES) {
      const v = (o.weights as Partial<Record<ProjectType, number>> | undefined)?.[t];
      if (v !== undefined) current.weights[t] = v;
    }
    for (const g of GOALS) {
      const v = (o.goalAdjust as Partial<Record<Goal, number>> | undefined)?.[g];
      if (v !== undefined) current.goalAdjust[g] = v;
    }
  }
  const hash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex").slice(0, 8);
  return { version: `${base.version}+${parsed.version ?? "custom"}.${hash}`, rules };
}

export function effectiveWeight(cfg: RuleWeightConfig, type: ProjectType, goal: Goal): number {
  const raw = cfg.weights[type] + (cfg.goalAdjust[goal] ?? 0);
  return Math.max(0, Math.min(3, raw));
}
