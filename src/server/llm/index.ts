import { AGENTS, type AgentName } from "@/server/agents/contracts";
import { MockProvider, isMockScenario } from "./mock";
import {
  isProviderName,
  type LLMProvider,
  type ProviderName,
} from "./provider";

export type AgentProviders = Record<AgentName, ProviderName>;

const envName = (agent: AgentName) => `LLM_PROVIDER_${agent.toUpperCase()}`;

/**
 * Provider of each agent for new runs (D26): LLM_PROVIDER_<AGENT>, mock by
 * default. LLM_PROVIDER=mock forces the mock on every agent (plan B, D8).
 */
export function providersForNewRun(): AgentProviders {
  const forceMock = process.env.LLM_PROVIDER === "mock";
  return Object.fromEntries(
    AGENTS.map((agent) => {
      const value = process.env[envName(agent)];
      return [agent, !forceMock && isProviderName(value) ? value : "mock"];
    }),
  ) as AgentProviders;
}

/** Short label stored in runs.provider, e.g. "gemini+mock". */
export const providerSummary = (p: AgentProviders) =>
  [...new Set(AGENTS.map((a) => p[a]))].join("+");

/** The mock scenario only matters when Develop or Testing is the mock (D26). */
export const usesMockScenario = (p: AgentProviders) =>
  p.develop === "mock" || p.testing === "mock";

/** Runs created before H4 stored a single provider name. */
export function runProviders(run: {
  provider: string;
  providers: AgentProviders | null;
}): AgentProviders {
  if (run.providers) return run.providers;
  const name = isProviderName(run.provider) ? run.provider : "mock";
  return { orchestrator: name, develop: name, testing: name };
}

/** Comma-separated model list of an agent, in fallback order (D26). */
export function modelsFor(agent: AgentName): string[] {
  const defaults: Record<AgentName, string> = {
    orchestrator: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite",
    develop: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite",
    testing: "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite",
  };
  const value =
    process.env[`GEMINI_MODELS_${agent.toUpperCase()}`] || defaults[agent];
  return value
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export async function getProvider(
  name: ProviderName,
  agent: AgentName,
  scenario: string | null,
): Promise<LLMProvider> {
  if (name === "mock") {
    return new MockProvider(isMockScenario(scenario) ? scenario : "ok");
  }
  // Loaded on demand: the SDK is only needed on the Gemini path.
  const { createGeminiProvider } = await import("./gemini");
  return createGeminiProvider(modelsFor(agent));
}
