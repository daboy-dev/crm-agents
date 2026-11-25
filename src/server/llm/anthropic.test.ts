import Anthropic from "@anthropic-ai/sdk";
import { ApiError } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { developOutputSchema } from "@/server/agents/contracts";
import {
  AnthropicClient,
  classifyAnthropicError,
  toAnthropicFormat,
} from "./anthropic";
import {
  AGENT_SETTINGS,
  ChainProvider,
  type ModelClient,
  type QuotaMemory,
} from "./chain";
import { GeminiClient } from "./gemini";
import developOk from "./fixtures/anthropic/develop-ok.json";
import error402 from "./fixtures/anthropic/error-402.json";
import error429 from "./fixtures/anthropic/error-429.json";
import error529 from "./fixtures/anthropic/error-529.json";
import { Overloaded, OutputTruncated, RateLimited } from "./provider";

// Answers in Anthropic's format: develop-ok.json was recorded from a real
// call (run #16, D37); nothing here calls the API.

type Reply = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

function anthropicLink(replies: Reply[]) {
  const queue = [...replies];
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const next = queue.shift();
    if (!next) throw new Error("unexpected call");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json", ...next.headers },
    });
  });
  const sdk = new Anthropic({ apiKey: "test", maxRetries: 0, fetch });
  return { link: new AnthropicClient("claude-sonnet-5-5", sdk), bodies };
}

function setup(links: ModelClient[]) {
  const marked = new Set<string>();
  const quota: QuotaMemory = {
    isExhausted: async (id) => marked.has(id),
    markExhausted: async (id) => void marked.add(id),
  };
  const provider = new ChainProvider({
    links,
    quota,
    settings: AGENT_SETTINGS.develop,
  });
  const run = () =>
    provider.generateObject({
      agent: "develop",
      system: "sistema",
      prompt: "tarea",
      input: null,
      schema: developOutputSchema,
    });
  return { run, marked };
}

describe("AnthropicClient (D37)", () => {
  it("returns the recorded Develop answer through the chain", async () => {
    const a = anthropicLink([developOk]);
    const { output, calls } = await setup([a.link]).run();
    expect(output.files.map((f) => f.path)).toEqual([
      "src/app/(crm)/clientes/page.tsx",
    ]);
    expect(calls).toEqual([
      expect.objectContaining({
        model: "anthropic:claude-sonnet-5-5",
        kind: "first",
        valid: true,
        inputTokens: 12_670,
        outputTokens: 2_105,
      }),
    ]);
    const body = a.bodies[0]!;
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.max_tokens).toBe(AGENT_SETTINGS.develop.maxOutputTokens);
    expect(body.output_config).toMatchObject({
      effort: "low",
      format: { type: "json_schema" },
    });
  });

  it("sends the contract as JSON Schema without $schema", () => {
    const format = toAnthropicFormat(developOutputSchema);
    expect(format.type).toBe("json_schema");
    expect(format.schema).not.toHaveProperty("$schema");
    expect(format.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
  });

  it("a 429 postpones the step with the retry-after", async () => {
    const a = anthropicLink([error429]);
    const error = await setup([a.link])
      .run()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimited);
    expect((error as RateLimited).retryAfterMs).toBe(12_000);
  });

  it("a 529 counts as busy, like a 503 of Gemini", async () => {
    const a = anthropicLink([error529]);
    const t = setup([a.link]);
    await expect(t.run()).rejects.toBeInstanceOf(Overloaded);
    expect(t.marked.size).toBe(0);
  });

  it("a 402 (no credit) skips the link for the day", async () => {
    const a = anthropicLink([error402]);
    const t = setup([a.link]);
    await expect(t.run()).rejects.toThrow("cuota diaria agotada");
    expect([...t.marked]).toEqual(["anthropic:claude-sonnet-5-5"]);
  });

  it("a cut answer is OutputTruncated, which splits the task (D34)", async () => {
    const cut = {
      status: 200,
      body: {
        ...developOk.body,
        content: [{ type: "text", text: '{"commitMessage":"feat: x","fil' }],
        stop_reason: "max_tokens",
      },
    };
    const a = anthropicLink([cut]);
    await expect(setup([a.link]).run()).rejects.toBeInstanceOf(OutputTruncated);
  });

  it("answers when every Gemini model is busy (25/11/2026)", async () => {
    const busy = new ApiError({ message: "high demand", status: 503 });
    const generate = vi.fn(async () => {
      throw busy;
    });
    const gemini = ["flash", "lite"].map((m) => new GeminiClient(m, generate));
    const a = anthropicLink([developOk]);
    const { calls } = await setup([...gemini, a.link]).run();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(calls.map((c) => c.model)).toEqual(["anthropic:claude-sonnet-5-5"]);
  });

  it("ignores errors that are not from the API", () => {
    expect(classifyAnthropicError(new Error("x"))).toBeNull();
  });
});
