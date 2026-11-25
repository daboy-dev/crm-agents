import { AGENTS, type AgentName } from "@/server/agents/contracts";
import {
  AGENT_SETTINGS,
  ChainProvider,
  chainFor,
  linkId,
  type Link,
  type ModelClient,
} from "./chain";
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

/**
 * Clients of the agent's chain (D36). A link whose API key is missing is
 * left out, so a missing backup key never stops the main models.
 */
export async function chainClients(links: Link[]): Promise<ModelClient[]> {
  const byProvider = (p: Link["provider"]) =>
    links.filter((l) => l.provider === p).map((l) => l.model);
  const clients = new Map<string, ModelClient>();
  const gemini = byProvider("gemini");
  if (gemini.length > 0 && process.env.GEMINI_API_KEY) {
    // Loaded on demand: the SDK is only needed on the Gemini path.
    const { geminiClients } = await import("./gemini");
    for (const c of geminiClients(gemini)) clients.set(c.id, c);
  }
  const groq = byProvider("groq");
  if (groq.length > 0 && process.env.GROQ_API_KEY) {
    const { groqClients } = await import("./groq");
    for (const c of groqClients(groq)) clients.set(c.id, c);
  }
  const anthropic = byProvider("anthropic");
  if (anthropic.length > 0 && process.env.ANTHROPIC_API_KEY) {
    const { anthropicClients } = await import("./anthropic");
    for (const c of anthropicClients(anthropic)) clients.set(c.id, c);
  }
  const missing = links.filter((l) => !clients.has(linkId(l)));
  if (missing.length > 0) {
    console.warn(
      `LLM: sin clave para ${missing.map(linkId).join(", ")}; se saltan`,
    );
  }
  const ordered = links.flatMap((l) => clients.get(linkId(l)) ?? []);
  if (ordered.length === 0) {
    throw new Error(
      "Falta GEMINI_API_KEY, ANTHROPIC_API_KEY o GROQ_API_KEY para la cadena",
    );
  }
  return ordered;
}

export async function getProvider(
  name: ProviderName,
  agent: AgentName,
  scenario: string | null,
): Promise<LLMProvider> {
  if (name === "mock") {
    return new MockProvider(isMockScenario(scenario) ? scenario : "ok");
  }
  const { appMetaQuota } = await import("./quota");
  return new ChainProvider({
    links: await chainClients(chainFor(agent)),
    quota: appMetaQuota(),
    settings: AGENT_SETTINGS[agent],
  });
}
