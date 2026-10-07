// Erste produktive LLM-Integration: Anthropic Messages API mit strukturierter Ausgabe.
// Der API-Schlüssel kommt ausschließlich serverseitig aus der Umgebung.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse, type Pricing } from "./types";

/** Listenpreise in USD pro Million Token (Stand der Implementierung, Oktober 2026). Maßgeblich ist die Anthropic-Abrechnung. */
export const ANTHROPIC_PRICING: Record<string, Pricing> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
};

/** Konservativer Preis für einen serverseitigen Fallback-Versuch (teuerstes übliches Fallback-Ziel). */
const FALLBACK_WORST_CASE: Pricing = { inputPerMTok: 5, outputPerMTok: 25 };

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  /** Serverseitiger Fallback bei Ablehnung durch Sicherheitsklassifikatoren (Beta "fallbacks: default"). */
  fallbacks: boolean;
  pricingOverride?: Pricing;
  /** Nur für Tests: eigener fetch statt Netzwerk. */
  fetch?: typeof fetch;
}

export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic" as const;
  readonly displayName = "Anthropic (Claude API)";
  readonly endpointHost = "api.anthropic.com";
  readonly model: string;
  readonly pricing: Pricing | null;
  readonly fallbackPricing: Pricing | null;
  private readonly client: Anthropic;
  private readonly effort: AnthropicProviderOptions["effort"];
  private readonly fallbacks: boolean;

  constructor(opts: AnthropicProviderOptions) {
    this.model = opts.model;
    this.effort = opts.effort;
    this.fallbacks = opts.fallbacks;
    this.pricing = opts.pricingOverride ?? ANTHROPIC_PRICING[opts.model] ?? null;
    this.fallbackPricing = opts.fallbacks ? FALLBACK_WORST_CASE : null;
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: opts.fetch ? 0 : 1, ...(opts.fetch ? { fetch: opts.fetch } : {}) });
  }

  async generate<T>(req: LlmRequest<T>): Promise<LlmResponse<T>> {
    let res;
    try {
      res = await this.client.beta.messages.parse(
        {
          model: this.model,
          max_tokens: req.maxOutputTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          output_config: { effort: this.effort, format: betaZodOutputFormat(req.schema) },
          ...(this.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { timeout: req.timeoutMs },
      );
    } catch (err) {
      throw mapError(err);
    }

    const usage = {
      inputTokens: (res.usage.input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0),
      outputTokens: res.usage.output_tokens ?? 0,
      iterations: Array.isArray(res.usage.iterations)
        ? res.usage.iterations.map((it) => {
            const x = it as unknown as Record<string, unknown>;
            return {
              type: String(x.type ?? "message"),
              model: typeof x.model === "string" ? x.model : null,
              inputTokens: Number(x.input_tokens ?? 0) + Number(x.cache_creation_input_tokens ?? 0) + Number(x.cache_read_input_tokens ?? 0),
              outputTokens: Number(x.output_tokens ?? 0),
            };
          })
        : undefined,
    };
    if (res.stop_reason === "refusal") throw new LlmError("refusal", "Das Modell hat die Anfrage abgelehnt.");
    if (res.stop_reason === "max_tokens") throw new LlmError("truncated", "Die Ausgabe wurde am Tokenlimit abgeschnitten.");
    if (res.parsed_output === null || res.parsed_output === undefined) throw new LlmError("invalid_output", "Die Ausgabe entsprach nicht dem Schema.");
    return { data: res.parsed_output, usage, model: res.model ?? this.model };
  }
}

function mapError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new LlmError("timeout", "Zeitlimit der KI-Anfrage überschritten.");
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) return new LlmError("auth", "Der KI-Anbieter lehnt die Zugangsdaten ab.");
  if (err instanceof Anthropic.RateLimitError) return new LlmError("rate_limited", "Ratenlimit des KI-Anbieters erreicht.");
  if (err instanceof Anthropic.BadRequestError) return new LlmError("provider_error", "Der KI-Anbieter hat die Anfrage als ungültig abgelehnt.");
  if (err instanceof Anthropic.APIConnectionError) return new LlmError("provider_error", "KI-Anbieter nicht erreichbar.");
  if (err instanceof Anthropic.APIError) return new LlmError("provider_error", `Fehler beim KI-Anbieter (${err.status ?? "ohne Status"}).`);
  if (err instanceof Anthropic.AnthropicError) return new LlmError("invalid_output", "Die Ausgabe konnte nicht verarbeitet werden.");
  return new LlmError("provider_error", "Unerwarteter Fehler bei der KI-Anfrage.");
}
