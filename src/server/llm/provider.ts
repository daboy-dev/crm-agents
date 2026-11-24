import type { z } from "zod";
import type { AgentName } from "@/server/agents/contracts";

/**
 * Swappable LLM layer (D8). Implementations: MockProvider (H3) and
 * GeminiProvider (H4+). Every agent output is validated against a Zod schema.
 */

export const PROVIDER_NAMES = ["mock", "gemini"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const isProviderName = (value: unknown): value is ProviderName =>
  PROVIDER_NAMES.includes(value as ProviderName);

/** One request answered by a model, as stored in agent_steps (D26). */
export type CallMeta = {
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

/** Every model of the agent's list is out of its daily quota (D26). */
export class QuotaExhausted extends Error {
  constructor(readonly models: string[]) {
    super("Cuota de Gemini agotada; se renueva a las 9:00");
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
