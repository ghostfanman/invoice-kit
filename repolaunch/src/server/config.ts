// Serverkonfiguration ausschließlich aus Umgebungsvariablen. Geheimnisse verlassen den Server nie.

import { readFileSync } from "node:fs";
import path from "node:path";
import { AnthropicProvider } from "@/core/ai/anthropic";
import { FakeProvider } from "@/core/ai/fake";
import { DEFAULT_AI_LIMITS, type AiLimits, type LlmProvider } from "@/core/ai/types";
import { applyRuleOverrides, DEFAULT_RULE_CONFIG, type RuleConfig } from "@/core/rules/config";

export interface ServerConfig {
  dataDir: string;
  dbFile: string;
  githubToken?: string;
  demoMode: boolean;
  jobTtlHours: number;
  maxActiveJobs: number;
  maxJobAttempts: number;
  rateLimitJobsPerHour: number;
  rateLimitAiPerHour: number;
  rateLimitReadsPerMinute: number;
  trustProxyHops: number;
  ai: {
    provider: "anthropic" | "fake" | "none";
    limits: AiLimits;
    anthropic?: { apiKey: string; model: string; effort: "low" | "medium" | "high" | "xhigh" | "max"; fallbacks: boolean; pricing?: { inputPerMTok: number; outputPerMTok: number } };
  };
  rules: RuleConfig;
}

function int(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Ungültiger Wert für ${name}: erlaubt ${min} bis ${max}`);
  return Math.floor(n);
}

function num(name: string, def: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Ungültiger Wert für ${name}: erlaubt ${min} bis ${max}`);
  return n;
}

function bool(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function loadConfig(): ServerConfig {
  // Laufzeitpfade: vom Bundler-Tracing ausnehmen.
  const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.REPOLAUNCH_DATA_DIR || "./data");
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const providerRaw = (process.env.AI_PROVIDER || (apiKey ? "anthropic" : "none")).toLowerCase();
  if (!["anthropic", "fake", "none"].includes(providerRaw)) throw new Error("AI_PROVIDER muss anthropic, fake oder none sein");
  if (providerRaw === "anthropic" && !apiKey) throw new Error("AI_PROVIDER=anthropic erfordert ANTHROPIC_API_KEY");
  const effort = (process.env.ANTHROPIC_EFFORT || "medium").toLowerCase();
  if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) throw new Error("ANTHROPIC_EFFORT ungültig");
  const priceIn = process.env.AI_PRICE_INPUT_PER_MTOK;
  const priceOut = process.env.AI_PRICE_OUTPUT_PER_MTOK;

  let rules = DEFAULT_RULE_CONFIG;
  if (process.env.REPOLAUNCH_RULES_CONFIG) {
    rules = applyRuleOverrides(DEFAULT_RULE_CONFIG, JSON.parse(readFileSync(/*turbopackIgnore: true*/ process.env.REPOLAUNCH_RULES_CONFIG, "utf8")));
  }

  return {
    dataDir,
    dbFile: process.env.REPOLAUNCH_DB_FILE ? path.resolve(/*turbopackIgnore: true*/ process.env.REPOLAUNCH_DB_FILE) : path.join(/*turbopackIgnore: true*/ dataDir, "repolaunch.sqlite"),
    githubToken: process.env.GITHUB_TOKEN?.trim() || undefined,
    demoMode: bool("REPOLAUNCH_DEMO", false),
    jobTtlHours: int("JOB_TTL_HOURS", 72, 1, 24 * 30),
    maxActiveJobs: int("MAX_ACTIVE_JOBS", 20, 1, 1000),
    maxJobAttempts: int("MAX_JOB_ATTEMPTS", 3, 1, 10),
    rateLimitJobsPerHour: int("RATE_LIMIT_JOBS_PER_HOUR", 10, 1, 10_000),
    rateLimitAiPerHour: int("RATE_LIMIT_AI_PER_HOUR", 3, 1, 1000),
    rateLimitReadsPerMinute: int("RATE_LIMIT_READS_PER_MINUTE", 120, 10, 100_000),
    trustProxyHops: int("TRUST_PROXY_HOPS", 0, 0, 5),
    ai: {
      provider: providerRaw as ServerConfig["ai"]["provider"],
      limits: {
        maxInputChars: int("AI_MAX_INPUT_CHARS", DEFAULT_AI_LIMITS.maxInputChars, 2000, 200_000),
        maxReadmeChars: int("AI_MAX_README_CHARS", DEFAULT_AI_LIMITS.maxReadmeChars, 1000, 100_000),
        maxOutputTokens: int("AI_MAX_OUTPUT_TOKENS", DEFAULT_AI_LIMITS.maxOutputTokens, 4000, 64_000),
        timeoutMs: int("AI_TIMEOUT_MS", DEFAULT_AI_LIMITS.timeoutMs, 10_000, 600_000),
        maxCostUsd: num("AI_MAX_COST_USD", DEFAULT_AI_LIMITS.maxCostUsd, 0.01, 50),
        maxRunsPerJob: int("AI_MAX_RUNS_PER_JOB", DEFAULT_AI_LIMITS.maxRunsPerJob, 1, 10),
      },
      anthropic:
        providerRaw === "anthropic" && apiKey
          ? {
              apiKey,
              model: process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5",
              effort: effort as "low" | "medium" | "high" | "xhigh" | "max",
              fallbacks: bool("ANTHROPIC_FALLBACKS", true),
              pricing: priceIn && priceOut ? { inputPerMTok: Number(priceIn), outputPerMTok: Number(priceOut) } : undefined,
            }
          : undefined,
    },
    rules,
  };
}

export function createProvider(cfg: ServerConfig): LlmProvider | null {
  if (cfg.ai.provider === "fake") return new FakeProvider("ok");
  if (cfg.ai.provider === "anthropic" && cfg.ai.anthropic) {
    const a = cfg.ai.anthropic;
    return new AnthropicProvider({ apiKey: a.apiKey, model: a.model, effort: a.effort, fallbacks: a.fallbacks, pricingOverride: a.pricing });
  }
  return null;
}

/** Werte, die nie in Ausgaben erscheinen dürfen. */
export function configSecrets(cfg: ServerConfig): string[] {
  return [cfg.githubToken, cfg.ai.anthropic?.apiKey].filter((x): x is string => Boolean(x));
}

let cached: ServerConfig | null = null;
export function getConfig(): ServerConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

export function resetConfigForTests(): void {
  cached = null;
}
