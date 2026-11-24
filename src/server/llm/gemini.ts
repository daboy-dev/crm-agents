import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentParameters,
} from "@google/genai";
import { z } from "zod";
import {
  InvalidOutput,
  QuotaExhausted,
  RateLimited,
  type CallMeta,
  type GenerateRequest,
  type Generated,
  type LLMProvider,
} from "./provider";

/**
 * GeminiProvider (D26): structured output with a JSON Schema generated from
 * the Zod contract, one repair call on a Zod error, a model list per agent
 * and no waiting inside the function on a 429.
 */

/** Per call (D26). Two calls plus the context fit in the step's lease. */
export const GEMINI_TIMEOUT_MS = 60_000;

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

/** Remembers which models ran out of their daily quota today (D26). */
export type QuotaMemory = {
  isExhausted(model: string): Promise<boolean>;
  markExhausted(model: string): Promise<void>;
};

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
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
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
 * lengths, patterns). Zod still validates all of it, refinements included.
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
 * Reasoning at the minimum the model takes (D26). Some models refuse
 * MINIMAL with a 400 that costs no quota; then LOW is their minimum.
 */
const THINKING_LEVELS = [ThinkingLevel.MINIMAL, ThinkingLevel.LOW];

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
export const isOverloaded = (error: unknown) =>
  [500, 503, 504].includes(
    (error as { status?: unknown } | null)?.status as number,
  );

// --- Provider ---

const responseText = (r: GeminiResponse) =>
  (r.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

/** Zod issues as a short list for the repair prompt and the logs. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 20)
    .map((i) => `- ${i.path.join(".") || "(raíz)"}: ${i.message}`)
    .join("\n");
}

type Parsed<T> = { ok: true; value: T } | { ok: false; problems: string };

function parse<T>(text: string, schema: z.ZodType<T>): Parsed<T> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      problems: `- La respuesta no es JSON válido: ${(error as Error).message}`,
    };
  }
  const result = schema.safeParse(json);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, problems: describeIssues(result.error) };
}

export const repairPrompt = (problems: string) =>
  [
    "Tu respuesta anterior no cumple el contrato. Errores:",
    problems,
    "",
    "Devuelve de nuevo el JSON completo, corregido y sin texto alrededor.",
  ].join("\n");

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";

  constructor(
    private readonly options: {
      generate: GenerateContent;
      models: string[];
      quota: QuotaMemory;
      timeoutMs?: number;
    },
  ) {
    if (options.models.length === 0) throw new Error("No Gemini models");
  }

  async generateObject<T>(request: GenerateRequest<T>): Promise<Generated<T>> {
    const jsonSchema = toGeminiSchema(request.schema);
    const skipped: string[] = [];
    let overloaded: unknown = null;
    for (const model of this.options.models) {
      if (await this.options.quota.isExhausted(model)) {
        skipped.push(model);
        continue;
      }
      try {
        return await this.withModel(model, request, jsonSchema);
      } catch (error) {
        const quota = classifyQuotaError(error);
        if (quota?.kind === "daily") {
          // Next model of the list (D26).
          await this.options.quota.markExhausted(model);
          skipped.push(model);
          continue;
        }
        if (quota?.kind === "minute") {
          throw new RateLimited(model, quota.retryAfterMs);
        }
        if (isOverloaded(error) && model !== this.options.models.at(-1)) {
          // Not a quota: try the next model now, without marking this one.
          overloaded = error;
          continue;
        }
        throw error;
      }
    }
    // The last models were out of quota but an earlier one was only busy.
    if (overloaded) throw overloaded;
    throw new QuotaExhausted(skipped);
  }

  /** First call and, if it does not validate, a single repair call. */
  private async withModel<T>(
    model: string,
    request: GenerateRequest<T>,
    jsonSchema: unknown,
  ): Promise<Generated<T>> {
    const calls: CallMeta[] = [];
    const contents: Content[] = [
      { role: "user", parts: [{ text: request.prompt }] },
    ];
    for (const kind of ["first", "repair"] as const) {
      const { text, meta } = await this.call(
        model,
        kind,
        request,
        contents,
        jsonSchema,
      );
      const parsed = parse(text, request.schema);
      const call = { ...meta, valid: parsed.ok };
      calls.push(call);
      await request.hooks?.onCall?.(call);
      if (parsed.ok) return { output: parsed.value, calls };
      if (kind === "repair") {
        throw new InvalidOutput(
          `${model}: la respuesta no cumple el contrato tras la reparación:\n${parsed.problems}`,
          calls,
        );
      }
      contents.push(
        { role: "model", parts: [{ text }] },
        { role: "user", parts: [{ text: repairPrompt(parsed.problems) }] },
      );
    }
    throw new Error("unreachable");
  }

  private async call<T>(
    model: string,
    kind: CallMeta["kind"],
    request: GenerateRequest<T>,
    contents: Content[],
    jsonSchema: unknown,
  ): Promise<{ text: string; meta: Omit<CallMeta, "valid"> }> {
    await request.hooks?.beforeCall?.();
    const timeout = this.options.timeoutMs ?? GEMINI_TIMEOUT_MS;
    const started = Date.now();
    let response: GeminiResponse | undefined;
    for (let i = thinkingFloor.get(model) ?? 0; !response; i++) {
      try {
        response = await this.options.generate({
          model,
          contents,
          config: {
            systemInstruction: request.system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            // Planning needs no long reasoning, and it keeps latency down (D26).
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
      meta: {
        model,
        kind,
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens:
          (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
        latencyMs: Date.now() - started,
      },
    };
  }
}

/** Provider of the app: SDK client, the agent's model list and app_meta. */
export async function createGeminiProvider(
  models: string[],
): Promise<GeminiProvider> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");
  const { appMetaQuota } = await import("./quota");
  const client = new GoogleGenAI({ apiKey });
  return new GeminiProvider({
    generate: (params) => client.models.generateContent(params),
    models,
    quota: appMetaQuota(),
  });
}
