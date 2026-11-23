import type { z } from "zod";

/**
 * Swappable LLM layer (D8). Implementations: GeminiProvider and MockProvider (H3+).
 * Every agent output is validated against a Zod schema.
 */
export interface LLMProvider {
  readonly name: string;
  generateObject<T>(request: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
  }): Promise<T>;
}
