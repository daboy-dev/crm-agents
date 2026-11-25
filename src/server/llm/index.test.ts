import { afterEach, describe, expect, it, vi } from "vitest";
import {
  providersForNewRun,
  providerSummary,
  runProviders,
  usesMockScenario,
} from "./index";

afterEach(() => vi.unstubAllEnvs());

describe("providers per agent (D26)", () => {
  it("defaults every agent to the mock", () => {
    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "");
    expect(providersForNewRun()).toEqual({
      orchestrator: "mock",
      develop: "mock",
      testing: "mock",
    });
  });

  it("reads LLM_PROVIDER_<AGENT>", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "gemini");
    vi.stubEnv("LLM_PROVIDER_DEVELOP", "nope");
    const p = providersForNewRun();
    expect(p).toEqual({
      orchestrator: "gemini",
      develop: "mock",
      testing: "mock",
    });
    expect(providerSummary(p)).toBe("gemini+mock");
    expect(usesMockScenario(p)).toBe(true);
  });

  it("LLM_PROVIDER=mock forces the mock (plan B)", () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("LLM_PROVIDER_ORCHESTRATOR", "gemini");
    expect(providersForNewRun().orchestrator).toBe("mock");
  });

  it("the scenario selector hides only when no agent is the mock", () => {
    expect(
      usesMockScenario({
        orchestrator: "mock",
        develop: "gemini",
        testing: "gemini",
      }),
    ).toBe(false);
  });

  it("runs before H4 used one provider for every agent", () => {
    expect(runProviders({ provider: "mock", providers: null })).toEqual({
      orchestrator: "mock",
      develop: "mock",
      testing: "mock",
    });
  });
});
