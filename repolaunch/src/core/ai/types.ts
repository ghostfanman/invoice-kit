// Austauschbare LLM-Schnittstelle. Die Verarbeitung danach (Validierung, Prüfung, Bereinigung) ist anbieterunabhängig.

import type { z } from "zod";
import type { Localized } from "../types";

export const AI_SECTIONS = ["readme", "descriptionTopics", "plan30", "launchTexts", "monetization", "landingPage"] as const;
export type AiSection = (typeof AI_SECTIONS)[number];

export interface LlmRequest<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
  timeoutMs: number;
}

export interface LlmIterationUsage {
  type: string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** Bei serverseitigem Fallback: jeder Versuch einzeln. */
  iterations?: LlmIterationUsage[];
}

export interface LlmResponse<T> {
  data: unknown;
  usage: LlmUsage;
  model: string;
  /** Typisierungsanker; wird nicht befüllt. */
  _type?: T;
}

export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface LlmProvider {
  readonly id: "anthropic" | "fake";
  readonly displayName: string;
  readonly model: string;
  readonly endpointHost: string;
  readonly pricing: Pricing | null;
  /** Zusätzlicher Worst Case, falls ein serverseitiger Fallback einen zweiten Versuch auslöst. */
  readonly fallbackPricing: Pricing | null;
  generate<T>(req: LlmRequest<T>): Promise<LlmResponse<T>>;
}

export type LlmErrorCode =
  | "timeout"
  | "refusal"
  | "invalid_output"
  | "truncated"
  | "rate_limited"
  | "auth"
  | "provider_error"
  | "budget_exceeded"
  | "not_configured";

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export interface AiLimits {
  maxInputChars: number;
  maxReadmeChars: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxCostUsd: number;
  maxRunsPerJob: number;
}

export const DEFAULT_AI_LIMITS: AiLimits = {
  maxInputChars: 30_000,
  maxReadmeChars: 16_000,
  maxOutputTokens: 16_000,
  timeoutMs: 180_000,
  maxCostUsd: 1.0,
  maxRunsPerJob: 2,
};

export interface DisclosureItem {
  id: string;
  label: Localized;
  source: "repository" | "audit" | "user";
  chars: number;
  note?: Localized;
}

export interface AiDisclosure {
  provider: string;
  model: string;
  endpointHost: string;
  items: DisclosureItem[];
  totalChars: number;
  redactedLines: number;
  limits: AiLimits;
  worstCaseCostUsd: number | null;
  isTestAdapter: boolean;
}

export interface VerificationNote {
  section: AiSection | "general";
  kind: "command" | "path" | "claim" | "link" | "topic" | "length";
  value: string;
  status: "verified" | "unverified";
  reason: Localized;
}

export interface AiCost {
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
  note: Localized;
}
