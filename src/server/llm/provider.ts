import type { z } from "zod";
import type { AgentName } from "@/server/agents/contracts";

/**
 * Swappable LLM layer (D8). Implementations: MockProvider (H3) and
 * ChainProvider (H4+, D36), a chain of provider:model links (Gemini, Groq).
 * Every agent output is validated against a Zod schema.
 */

/**
 * Provider of an agent. "gemini" (the name since H4, kept for the env vars
 * and the stored runs) means the agent's real chain, LLM_CHAIN_<AGENT>.
 */
export const PROVIDER_NAMES = ["mock", "gemini"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const isProviderName = (value: unknown): value is ProviderName =>
  PROVIDER_NAMES.includes(value as ProviderName);

/** One request answered by a model, as stored in agent_steps (D26). */
export type CallMeta = {
  /** Link of the chain, "provider:model" (D36). Before H5, the bare model. */
  model: string;
  /** first answer, or the single repair call after a Zod error */
  kind: "first" | "repair";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** The answer passed the schema. */
  valid: boolean;
};

/** Called around every request, so the engine can count and hold the run. */
export type CallHooks = {
  /** Before each request: renews the lease, or throws when over budget. */
  beforeCall?: () => Promise<void>;
  /** After each answered request (it counts in LLM_CALLS_PER_RUN). */
  onCall?: (call: CallMeta) => Promise<void>;
};

export type GenerateRequest<T> = {
  agent: AgentName;
  system: string;
  prompt: string;
  /** Structured input behind the prompt. Only the mock reads it. */
  input: unknown;
  schema: z.ZodType<T>;
  hooks?: CallHooks;
};

export type Generated<T> = { output: T; calls: CallMeta[] };

export interface LLMProvider {
  readonly name: ProviderName;
  generateObject<T>(request: GenerateRequest<T>): Promise<Generated<T>>;
}

/** Per-minute limit: the step is postponed, not failed (D26). */
export class RateLimited extends Error {
  constructor(
    readonly model: string,
    readonly retryAfterMs: number,
  ) {
    super(
      `${model}: límite por minuto, se reintenta en ${Math.ceil(retryAfterMs / 1000)} s`,
    );
  }
}

/**
 * Every link that could answer was busy (500, 503 or 504). Not a failure of
 * the step: the engine tries again later without spending an attempt.
 */
export class Overloaded extends Error {
  constructor(readonly models: string[]) {
    super(
      `Modelos saturados (${models.join(", ")}): se reintenta en un momento`,
    );
  }
}

/**
 * No link of the agent's chain can answer: out of daily quota (it resets at
 * 9:00 in Madrid, D26) or too small for the request (D36).
 */
export class QuotaExhausted extends Error {
  constructor(readonly reasons: string[]) {
    super(
      `Ningún modelo de la cadena puede responder; la cuota diaria se renueva a las 9:00. ${reasons.join(" · ")}`,
    );
  }
}

/**
 * The answer was cut at maxOutputTokens: its JSON is incomplete, so it is
 * not repaired. For Develop the task is split (D34).
 */
export class OutputTruncated extends Error {
  constructor(
    readonly model: string,
    readonly maxOutputTokens: number,
    readonly calls: CallMeta[],
  ) {
    super(
      `${model}: la respuesta se ha cortado al llegar a ${maxOutputTokens} tokens de salida`,
    );
  }
}

/** The answer did not pass the schema, even after the repair call. */
export class InvalidOutput extends Error {
  constructor(
    message: string,
    readonly calls: CallMeta[],
  ) {
    super(message);
  }
}
