import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chainFor,
  DEFAULT_CHAINS,
  estimateTokens,
  leaseSecondsFor,
  MIN_OUTPUT_TOKENS,
  outputBudget,
  parseChain,
} from "./chain";

afterEach(() => vi.unstubAllEnvs());

describe("parseChain (D36)", () => {
  it("reads provider:model links in order", () => {
    expect(
      parseChain(" gemini:gemini-3.8-flash , ,groq:openai/gpt-oss-120b"),
    ).toEqual([
      { provider: "gemini", model: "gemini-3.8-flash" },
      { provider: "groq", model: "openai/gpt-oss-120b" },
    ]);
  });

  it("rejects unknown providers and links without a model", () => {
    expect(() => parseChain("openai:gpt")).toThrow("openai:gpt");
    expect(() => parseChain("gemini-3.8-flash")).toThrow();
    expect(() => parseChain("groq:")).toThrow();
  });
});

describe("chainFor", () => {
  it("Groq backs up only the orchestrator by default", () => {
    vi.stubEnv("LLM_CHAIN_ORCHESTRATOR", "");
    vi.stubEnv("LLM_CHAIN_DEVELOP", "");
    expect(chainFor("orchestrator").at(-1)).toEqual({
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
    expect(chainFor("develop").map((l) => l.provider)).toEqual([
      "gemini",
      "gemini",
      "gemini",
    ]);
    expect(DEFAULT_CHAINS.testing).not.toContain("groq:");
  });

  it("LLM_CHAIN_<AGENT> replaces the default", () => {
    vi.stubEnv("LLM_CHAIN_ORCHESTRATOR", "groq:openai/gpt-oss-120b");
    expect(chainFor("orchestrator")).toEqual([
      { provider: "groq", model: "openai/gpt-oss-120b" },
    ]);
  });
});

describe("sizing", () => {
  it("keeps the agent's limit when the link has room", () => {
    expect(outputBudget(250_000, 40_000, 32_768)).toBe(32_768);
  });

  it("lowers the output to what is left of the tokens per minute", () => {
    expect(outputBudget(8_000, 5_300, 16_384)).toBe(2_700);
  });

  it("skips the link when too little is left", () => {
    expect(outputBudget(8_000, 8_000 - MIN_OUTPUT_TOKENS + 1, 16_384)).toBe(
      null,
    );
    expect(outputBudget(8_000, 40_000, 32_768)).toBe(null);
  });

  it("estimates about four characters per token", () => {
    expect(estimateTokens("x".repeat(4_001))).toBe(1_001);
  });
});

describe("leaseSecondsFor (D35)", () => {
  it("outlives the agent's timeout by 30 s", () => {
    expect(leaseSecondsFor("develop")).toBe(180);
    expect(leaseSecondsFor("orchestrator")).toBe(90);
  });
});
