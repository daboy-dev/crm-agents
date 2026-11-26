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

describe("quotaStatus (D48, D49)", () => {
  it("nothing exhausted: the head of each chain, no fallback", () => {
    const got = quotaStatus(chains, new Set());
    expect(got.map((q) => [q.next, q.head, q.fallback])).toEqual([
      ["gemini:gemini-3.8-flash", "gemini:gemini-3.8-flash", false],
      ["gemini:gemini-3.8-flash", "gemini:gemini-3.8-flash", false],
    ]);
  });

  it("every Gemini link exhausted: both chains fall back", () => {
    const got = quotaStatus(
      chains,
      new Set(["gemini:gemini-3.8-flash", "gemini:gemini-3.6-flash"]),
    );
    expect(got.map((q) => [q.agent, q.next, q.fallback])).toEqual([
      ["develop", "anthropic:claude-sonnet-5-5", true],
      ["testing", "groq:openai/gpt-oss-120b", true],
    ]);
  });

  it("Claude first (D49): an exhausted Gemini behind it changes nothing", () => {
    const delivery = parseChain(
      "anthropic:claude-sonnet-5-5,gemini:gemini-3.8-flash",
    );
    const [got] = quotaStatus(
      [{ agent: "develop", links: delivery }],
      new Set(["gemini:gemini-3.8-flash"]),
    );
    expect(got).toMatchObject({
      next: "anthropic:claude-sonnet-5-5",
      fallback: false,
    });
  });

  it("every link exhausted: no next link", () => {
    const all = new Set(
      [...develop, ...testing].map((l) => `${l.provider}:${l.model}`),
    );
    const got = quotaStatus(chains, all);
    expect(got.map((q) => [q.next, q.fallback])).toEqual([
      [null, false],
      [null, false],
    ]);
  });
});
