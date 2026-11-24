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

export interface LLMProvider {
  readonly name: string;
  generateObject<T>(request: GenerateRequest<T>): Promise<T>;
}
