import type { z } from "zod";
import type { AgentName } from "@/server/agents/contracts";

/**
 * Swappable LLM layer (D8). Implementations: MockProvider (H3) and
 * GeminiProvider (H4+). Every agent output is validated against a Zod schema.
 */
export type GenerateRequest<T> = {
  agent: AgentName;
  system: string;
  prompt: string;
  /** Structured input behind the prompt. Only the mock reads it. */
  input: unknown;
  schema: z.ZodType<T>;
};

export const PROVIDER_NAMES = ["mock", "gemini"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

/** One request to a model, as stored in agent_steps (D26). */
export type CallMeta = {
  model: string;
  /** first answer or the single repair call after a Zod error */
  kind: "first" | "repair";
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /** The answer passed the schema. */
  valid: boolean;
};

export interface LLMProvider {
  readonly name: string;
  generateObject<T>(request: GenerateRequest<T>): Promise<T>;
}
