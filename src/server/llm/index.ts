import { MockProvider, isMockScenario } from "./mock";
import type { LLMProvider } from "./provider";

/** Provider for new runs. Only the mock exists until H4. */
export function defaultProviderName(): string {
  return process.env.LLM_PROVIDER || "mock";
}

export function getProvider(
  name: string,
  scenario: string | null,
): LLMProvider {
  if (name === "mock") {
    return new MockProvider(isMockScenario(scenario) ? scenario : "ok");
  }
  throw new Error(`Unknown LLM provider: ${name}`);
}
