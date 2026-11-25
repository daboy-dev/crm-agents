import { z } from "zod";
import type {
  Completion,
  CompletionRequest,
  LinkError,
  ModelClient,
} from "./chain";

/**
 * Groq link of the chain (D36), through its OpenAI-compatible API, with no
 * SDK. Structured output with response_format json_schema in best-effort
 * mode (strict needs every property required); Zod and the repair call of
 * the chain still validate everything.
 */

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Tokens per minute of the free tier, per model and organization (checked
 * 24/11/2026 in Groq's limits table, D36). Models not listed get the lowest.
 */
export const GROQ_TOKENS_PER_MINUTE: Record<string, number> = {
  "openai/gpt-oss-120b": 8_000,
};
const DEFAULT_TOKENS_PER_MINUTE = 6_000;

/** Without a retry-after, wait a full minute window. */
const DEFAULT_RETRY_MS = 60_000;

export type GroqResponse = {
  choices?: {
    message?: { content?: string | null; reasoning?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** A non-2xx answer of the API. */
export class GroqError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** From the retry-after header, in ms. */
    readonly retryAfterMs: number | null,
    readonly code: string | null,
  ) {
    super(`Groq ${status}: ${message}`);
  }
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** "Please try again in 1m2.5s" or "in 850ms", as ms. */
export function parseTryAgain(message: string): number | null {
  const m =
    /try again in ((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?(?:[\d.]+ms)?)/i.exec(
      message,
    );
  if (!m?.[1]) return null;
  let ms = 0;
  for (const [, n, unit] of m[1].matchAll(/([\d.]+)(h|ms|m|s)/g)) {
    const value = Number.parseFloat(n!);
    ms += value * { h: 3_600_000, m: 60_000, s: 1000, ms: 1 }[unit as "h"];
  }
  return ms > 0 ? Math.ceil(ms) : null;
}

export function classifyGroqError(error: unknown): LinkError | null {
  if (!(error instanceof GroqError)) return null;
  if (error.status === 429) {
    // Per day: requests (RPD) or tokens (TPD). Anything else is per minute.
    if (/per day|\((RPD|TPD)\)/i.test(error.message)) return { kind: "daily" };
    return {
      kind: "minute",
      retryAfterMs:
        error.retryAfterMs ?? parseTryAgain(error.message) ?? DEFAULT_RETRY_MS,
    };
  }
  if (error.status === 413 || error.code === "context_length_exceeded") {
    return { kind: "too_large" };
  }
  if ([498, 500, 502, 503, 504].includes(error.status)) {
    return { kind: "overloaded" };
  }
  return null;
}

/** JSON Schema of the contract, without lengths and patterns. */
export function toGroqSchema(schema: z.ZodType): unknown {
  const json = z.toJSONSchema(schema, {
    target: "draft-07",
    io: "output",
    reused: "inline",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

function finishOf(r: GroqResponse): Completion["finish"] {
  const reason = r.choices?.[0]?.finish_reason;
  if (reason === "length") return "max_tokens";
  return !reason || reason === "stop" ? "stop" : "other";
}

export class GroqClient implements ModelClient {
  readonly id: string;
  readonly tokensPerMinute: number;

  constructor(
    private readonly model: string,
    private readonly options: { apiKey: string; fetch?: Fetch },
  ) {
    this.id = `groq:${model}`;
    this.tokensPerMinute =
      GROQ_TOKENS_PER_MINUTE[model] ?? DEFAULT_TOKENS_PER_MINUTE;
  }

  classify(error: unknown): LinkError | null {
    return classifyGroqError(error);
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const doFetch = this.options.fetch ?? fetch;
    const body = {
      model: this.model,
      messages: [
        { role: "system", content: request.system },
        ...request.messages.map((m) => ({
          role: m.role === "model" ? "assistant" : "user",
          content: m.text,
        })),
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "output",
          schema: toGroqSchema(request.schema),
          strict: false,
        },
      },
      max_completion_tokens: request.maxOutputTokens,
      // Only the gpt-oss models take a reasoning effort.
      ...(this.model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
    };
    const response = await doFetch(GROQ_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text;
      let code: string | null = null;
      let failed: string | null = null;
      try {
        const parsed = JSON.parse(text) as {
          error?: {
            message?: string;
            code?: string;
            failed_generation?: string;
          };
        };
        message = parsed.error?.message ?? text;
        code = parsed.error?.code ?? null;
        failed = parsed.error?.failed_generation ?? null;
      } catch {
        // Not JSON: keep the raw text.
      }
      if (response.status === 400 && code === "json_validate_failed") {
        // The model answered but its JSON broke the schema: an answer for
        // Zod and the repair call, not an error of the link.
        return {
          text: failed ?? "",
          finish: "stop",
          inputTokens: 0,
          outputTokens: 0,
        };
      }
      const retryAfter = Number.parseFloat(
        response.headers.get("retry-after") ?? "",
      );
      throw new GroqError(
        response.status,
        message.slice(0, 1000),
        Number.isFinite(retryAfter) ? Math.ceil(retryAfter * 1000) : null,
        code,
      );
    }
    const json = (await response.json()) as GroqResponse;
    return {
      text: json.choices?.[0]?.message?.content ?? "",
      finish: finishOf(json),
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }
}

export function groqClients(models: string[]): GroqClient[] {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Falta GROQ_API_KEY");
  return models.map((model) => new GroqClient(model, { apiKey }));
}
