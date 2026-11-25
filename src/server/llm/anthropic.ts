import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { z } from "zod";
import type {
  Completion,
  CompletionRequest,
  LinkError,
  ModelClient,
} from "./chain";

/**
 * Anthropic link of the chain (D37): a paid backup when Gemini has no model
 * left. Structured output with output_config.format, from the same Zod
 * contract; the SDK drops the constraints the API does not take, and Zod and
 * the repair call of the chain still validate everything.
 */

/**
 * Far above any request of the agents: the key's limits are millions of
 * tokens per minute (checked 25/11/2026 in the rate limit headers).
 */
export const ANTHROPIC_TOKENS_PER_MINUTE = 1_000_000;

/** Without a retry-after, wait a full minute window. */
const DEFAULT_RETRY_MS = 60_000;

export function toAnthropicFormat(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { unrepresentable: "any" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return jsonSchemaOutputFormat(json as never);
}

/** How the chain treats an error of the API (D26 rules, D37). */
export function classifyAnthropicError(error: unknown): LinkError | null {
  if (!(error instanceof Anthropic.APIError)) return null;
  const status = error.status;
  if (status === 429) {
    const after = Number.parseFloat(error.headers?.get("retry-after") ?? "");
    return {
      kind: "minute",
      retryAfterMs: Number.isFinite(after)
        ? Math.ceil(after * 1000)
        : DEFAULT_RETRY_MS,
    };
  }
  // 402 billing_error: no credit left, like a daily quota for this link.
  if (status === 402) return { kind: "daily" };
  if (status === 413) return { kind: "too_large" };
  // 529 overloaded_error and other 5xx: another link may answer now.
  if (status !== undefined && status >= 500) return { kind: "overloaded" };
  return null;
}

function finishOf(message: Anthropic.Message): Completion["finish"] {
  if (message.stop_reason === "max_tokens") return "max_tokens";
  if (message.stop_reason === "end_turn") return "stop";
  return "other";
}

export class AnthropicClient implements ModelClient {
  readonly id: string;
  readonly tokensPerMinute = ANTHROPIC_TOKENS_PER_MINUTE;

  constructor(
    private readonly model: string,
    private readonly client: Anthropic,
  ) {
    this.id = `anthropic:${model}`;
  }

  classify(error: unknown): LinkError | null {
    return classifyAnthropicError(error);
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const message = await this.client.messages.create(
      {
        model: this.model,
        system: request.system,
        messages: request.messages.map((m) => ({
          role: m.role === "model" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        })),
        max_tokens: request.maxOutputTokens,
        // Adaptive thinking is always on; low effort keeps it short (D35).
        output_config: {
          effort: "low",
          format: toAnthropicFormat(request.schema),
        },
      },
      // A 429 must never wait inside the function: no SDK retries.
      { timeout: request.timeoutMs, maxRetries: 0 },
    );
    const text = message.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("");
    return {
      text,
      finish: finishOf(message),
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}

export function anthropicClients(
  models: string[],
  options: { fetch?: typeof fetch } = {},
): AnthropicClient[] {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey, maxRetries: 0, ...options });
  return models.map((model) => new AnthropicClient(model, client));
}
