// Strukturierte Ausgabe des KI-Launch-Pakets. Das Schema enthält nur die gewählten Abschnitte.

import { z } from "zod";
import type { AiSection } from "./types";

const str = (max: number) => z.string().max(max);

export const readmeSchema = z.object({
  markdown: str(40_000),
  notes: z.array(str(500)).max(20),
});

export const descriptionTopicsSchema = z.object({
  description: str(350),
  topics: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,49}$/)).max(20),
  rationale: str(1000),
});

export const plan30Schema = z.object({
  tasks: z
    .array(
      z.object({
        week: z.number().int().min(1).max(4),
        title: str(200),
        why: str(800),
        effort: str(100),
        findingIds: z.array(str(80)).max(10),
      }),
    )
    .max(10),
});

export const launchTextsSchema = z.object({
  linkedin: str(3000),
  community: z.object({ name: str(120), text: str(4000) }),
  releaseAnnouncement: str(4000),
});

export const MONETIZATION_TYPES = ["sponsoring", "paid_setup", "support_maintenance", "training", "hosted_version", "commercial_features"] as const;

export const monetizationSchema = z.object({
  options: z
    .array(
      z.object({
        type: z.enum(MONETIZATION_TYPES),
        title: str(200),
        whoPays: str(500),
        forWhat: str(500),
        prerequisites: z.array(str(300)).max(8),
        effort: str(200),
        targetCustomers: str(400),
        priceHypothesis: str(300),
      }),
    )
    .length(3),
});

export const landingPageSchema = z.object({
  markdown: str(20_000),
});

const SECTION_SCHEMAS = {
  readme: readmeSchema,
  descriptionTopics: descriptionTopicsSchema,
  plan30: plan30Schema,
  launchTexts: launchTextsSchema,
  monetization: monetizationSchema,
  landingPage: landingPageSchema,
} as const;

export interface AiOutput {
  readme?: z.infer<typeof readmeSchema>;
  descriptionTopics?: z.infer<typeof descriptionTopicsSchema>;
  plan30?: z.infer<typeof plan30Schema>;
  launchTexts?: z.infer<typeof launchTextsSchema>;
  monetization?: z.infer<typeof monetizationSchema>;
  landingPage?: z.infer<typeof landingPageSchema>;
  openQuestions: string[];
  userProvidedFactsUsed: string[];
}

/** Baut ein striktes Schema mit genau den gewählten Abschnitten als Pflichtfeldern. */
export function buildOutputSchema(sections: AiSection[]): z.ZodType<AiOutput> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const s of sections) shape[s] = SECTION_SCHEMAS[s];
  shape.openQuestions = z.array(str(500)).max(20);
  shape.userProvidedFactsUsed = z.array(str(500)).max(20);
  return z.object(shape).strict() as unknown as z.ZodType<AiOutput>;
}
