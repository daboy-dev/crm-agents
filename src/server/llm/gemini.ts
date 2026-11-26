import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentParameters,
} from "@google/genai";
import { z } from "zod";
import type {
  Completion,
  CompletionRequest,
  LinkError,
  ModelClient,
  Thinking,
} from "./chain";

/**
 * Gemini link of the chain (D26, D36): structured output with a JSON Schema
 * generated from the Zod contract, the lowest thinking level the model takes
 * and no waiting inside the function on a 429.
 */

/** Gemini's free tier, per model and project (D26). */
export const GEMINI_TOKENS_PER_MINUTE = 250_000;

/** The answer of the API, as far as the provider reads it. */
export type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

/** models.generateContent of the SDK, injected so tests use recorded answers. */
export type GenerateContent = (
  params: GenerateContentParameters,
) => Promise<GeminiResponse>;

// --- JSON Schema for Gemini ---

/** The subset of JSON Schema that responseJsonSchema accepts (SDK types). */
const SUPPORTED_KEYS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
  "propertyOrdering",
]);

function prune(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(prune);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    // A z.literal (the action of a step, D38) is a const: Gemini takes enums.
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    if (!SUPPORTED_KEYS.has(key)) continue;
    if (key === "properties" || key === "$defs") {
      // Keys here are property names, not schema keywords.
      out[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          prune(v),
        ]),
      );
    } else {
      out[key] = prune(value);
    }
  }
  return out;
}

/**
 * JSON Schema of the contract, without what Gemini does not take (string
 * lengths, patterns) nor numeric and array bounds: with them, the steps of
 * Testing (D38) are "a constraint that has too many states" (run #21). Zod
 * still validates all of it, refinements included.
 */
export function toGeminiSchema(schema: z.ZodType): unknown {
  return prune(
    z.toJSONSchema(schema, {
      target: "draft-2020-12",
      io: "output",
      reused: "inline",
      unrepresentable: "any",
    }),
  );
}

// --- Errors ---

type GoogleErrorBody = {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: {
      "@type"?: string;
      retryDelay?: string;
      violations?: { quotaId?: string; quotaMetric?: string }[];
    }[];
  };
};

export type QuotaError =
  { kind: "daily" } | { kind: "minute"; retryAfterMs: number };

/** Without a RetryInfo, wait a full minute window. */
const DEFAULT_RETRY_MS = 60_000;

/**
 * Tells a per-day 429 from a per-minute one. The SDK's ApiError carries the
 * JSON body of the API in its message (QuotaFailure and RetryInfo details).
 */
export function classifyQuotaError(error: unknown): QuotaError | null {
  const e = error as { status?: unknown; message?: unknown } | null;
  if (!e || e.status !== 429) return null;
  let body: GoogleErrorBody = {};
  try {
    body = JSON.parse(String(e.message)) as GoogleErrorBody;
  } catch {
    // Not JSON: treat as per-minute below.
  }
  const details = body.error?.details ?? [];
  const daily = details.some((d) =>
    (d.violations ?? []).some((v) =>
      /PerDay/i.test(`${v.quotaId ?? ""} ${v.quotaMetric ?? ""}`),
    ),
  );
  if (daily) return { kind: "daily" };
  const delay = details.find((d) => d.retryDelay)?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : NaN;
  return {
    kind: "minute",
    retryAfterMs: Number.isFinite(seconds)
      ? Math.ceil(seconds * 1000)
      : DEFAULT_RETRY_MS,
  };
}

// --- Thinking level ---

/**
 * Reasoning at the minimum the model takes (D26): the orchestrator asks for
 * MINIMAL and Develop for LOW (D35). Some models refuse MINIMAL with a 400
 * that costs no quota; then LOW is their minimum.
 */
const THINKING_LEVELS = [ThinkingLevel.MINIMAL, ThinkingLevel.LOW];
const FIRST_LEVEL: Record<Thinking, number> = { minimal: 0, low: 1 };

/** Lowest level each model accepted, for the life of the instance. */
const thinkingFloor = new Map<string, number>();

export function isThinkingLevelRejected(error: unknown): boolean {
  const e = error as { status?: unknown; message?: unknown } | null;
  return e?.status === 400 && /thinking level/i.test(String(e.message ?? ""));
}

/**
 * Model unavailable on Google's side (500, 503 "high demand", 504 deadline
 * exceeded): another model of the list may answer now.
 */
/**
 * The schema is too complex for the model (400 "too many states"): this
 * link cannot serve the request, the next one may (run #21).
 */
export function isSchemaTooComplex(error: unknown): boolean {
  const e = error as { status?: unknown; message?: unknown } | null;
  return e?.status === 400 && /too many states/i.test(String(e.message ?? ""));
}

export const isOverloaded = (error: unknown) =>
  [500, 503, 504].includes(
    (error as { status?: unknown } | null)?.status as number,
  );

// --- Client ---

const responseText = (r: GeminiResponse) =>
  (r.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

function finishOf(r: GeminiResponse): Completion["finish"] {
  const reason = r.candidates?.[0]?.finishReason;
  if (reason === "MAX_TOKENS") return "max_tokens";
  return !reason || reason === "STOP" ? "stop" : "other";
}

export class GeminiClient implements ModelClient {
  readonly id: string;
  readonly tokensPerMinute = GEMINI_TOKENS_PER_MINUTE;

  constructor(
    private readonly model: string,
    private readonly generate: GenerateContent,
  ) {
    this.id = `gemini:${model}`;
  }

  classify(error: unknown): LinkError | null {
    const quota = classifyQuotaError(error);
    if (quota) return quota;
    if (isSchemaTooComplex(error)) return { kind: "too_large" };
    return isOverloaded(error) ? { kind: "overloaded" } : null;
  }

  async complete(request: CompletionRequest): Promise<Completion> {
    const { model } = this;
    const timeout = request.timeoutMs;
    const first = Math.max(
      FIRST_LEVEL[request.thinking],
      thinkingFloor.get(model) ?? 0,
    );
    let response: GeminiResponse | undefined;
    for (let i = first; !response; i++) {
      try {
        response = await this.generate({
          model,
          contents: request.messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
          config: {
            systemInstruction: request.system,
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiSchema(request.schema),
            maxOutputTokens: request.maxOutputTokens,
            thinkingConfig: { thinkingLevel: THINKING_LEVELS[i] },
            // A 429 must never wait inside the function: no SDK retries.
            httpOptions: { timeout, retryOptions: { attempts: 1 } },
            abortSignal: AbortSignal.timeout(timeout),
          },
        });
        thinkingFloor.set(model, i);
      } catch (error) {
        if (
          !isThinkingLevelRejected(error) ||
          i + 1 >= THINKING_LEVELS.length
        ) {
          throw error;
        }
      }
    }
    const usage = response.usageMetadata ?? {};
    return {
      text: responseText(response),
      finish: finishOf(response),
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens:
        (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    };
  }
}

/** Gemini links of the app, sharing one SDK client. */
export function geminiClients(models: string[]): GeminiClient[] {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");
  const client = new GoogleGenAI({ apiKey });
  const generate: GenerateContent = (params) =>
    client.models.generateContent(params);
  return models.map((model) => new GeminiClient(model, generate));
}
