import { describe, expect, it } from "vitest";
import { parseChain } from "./chain";
import { quotaStatus } from "./quota-status";

const develop = parseChain(
  "gemini:gemini-3.8-flash,gemini:gemini-3.6-flash,anthropic:claude-sonnet-5-5",
);
const testing = parseChain(
  "gemini:gemini-3.8-flash,groq:openai/gpt-oss-120b,anthropic:claude-sonnet-5-5",
);
const chains = [
  { agent: "develop" as const, links: develop },
  { agent: "testing" as const, links: testing },
];

describe("quotaStatus (D48)", () => {
  it("nothing exhausted: Gemini first, nothing paid", () => {
    const got = quotaStatus(chains, new Set());
    expect(got.map((q) => [q.next, q.paid, q.geminiExhausted])).toEqual([
      ["gemini:gemini-3.8-flash", false, false],
      ["gemini:gemini-3.8-flash", false, false],
    ]);
  });

  it("every Gemini link exhausted: Develop pays, Testing goes to Groq", () => {
    const got = quotaStatus(
      chains,
      new Set(["gemini:gemini-3.8-flash", "gemini:gemini-3.6-flash"]),
    );
    expect(got.map((q) => [q.agent, q.next, q.paid])).toEqual([
      ["develop", "anthropic:claude-sonnet-5-5", true],
      ["testing", "groq:openai/gpt-oss-120b", false],
    ]);
    expect(got.every((q) => q.geminiExhausted)).toBe(true);
  });

  it("every link exhausted: no next link", () => {
    const all = new Set(
      [...develop, ...testing].map((l) => `${l.provider}:${l.model}`),
    );
    expect(quotaStatus(chains, all).map((q) => q.next)).toEqual([null, null]);
  });
});
