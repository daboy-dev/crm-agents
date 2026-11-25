import { stepsSchema } from "@/server/agents/contracts";
import { describe, expect, it, vi } from "vitest";
import { planSchema } from "@/server/agents/contracts";
import { AGENT_SETTINGS, ChainProvider, type QuotaMemory } from "./chain";
import { GeminiClient, type GeminiResponse } from "./gemini";
import {
  classifyGroqError,
  GroqClient,
  GroqError,
  GROQ_URL,
  parseTryAgain,
} from "./groq";
import daily429 from "./fixtures/groq/error-429-daily.json";
import minute429 from "./fixtures/groq/error-429-minute.json";
import tooLarge413 from "./fixtures/groq/error-413.json";
import jsonValidate from "./fixtures/groq/error-json-validate.json";
import planLength from "./fixtures/groq/plan-length.json";
import planOk from "./fixtures/groq/plan-ok.json";
import geminiPlanOk from "./fixtures/gemini/plan-ok.json";
import { OutputTruncated, QuotaExhausted, RateLimited } from "./provider";

// Answers in Groq's documented format: nothing here calls Groq (D30, D36).

type Reply = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

const ok = (body: unknown): Reply => ({ status: 200, body });

function setup(replies: Reply[], options: { prompt?: string } = {}) {
  const queue = [...replies];
  const bodies: Record<string, unknown>[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe(GROQ_URL);
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const next = queue.shift();
    if (!next) throw new Error("unexpected call");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: next.headers,
    });
  });
  const marked = new Set<string>();
  const quota: QuotaMemory = {
    isExhausted: async (id) => marked.has(id),
    markExhausted: async (id) => void marked.add(id),
  };
  const client = new GroqClient("openai/gpt-oss-120b", {
    apiKey: "test",
    fetch,
  });
  const provider = new ChainProvider({
    links: [client],
    quota,
    settings: AGENT_SETTINGS.orchestrator,
  });
  const run = () =>
    provider.generateObject({
      agent: "orchestrator",
      system: "sistema",
      prompt: options.prompt ?? "petición",
      input: null,
      schema: planSchema,
    });
  return { run, bodies, fetch, marked, client };
}

describe("parseTryAgain", () => {
  it("reads Groq's wait times", () => {
    expect(parseTryAgain("Please try again in 1m2.5s.")).toBe(62_500);
    expect(parseTryAgain("Please try again in 850ms.")).toBe(850);
    expect(parseTryAgain("Please try again in 7m12s.")).toBe(432_000);
    expect(parseTryAgain("no hint")).toBe(null);
  });
});

describe("classifyGroqError", () => {
  const error = (status: number, body: { error: { message: string } }) =>
    new GroqError(status, body.error.message, null, null);

  it("tells a daily limit from a per-minute one", () => {
    expect(classifyGroqError(error(429, daily429))).toEqual({ kind: "daily" });
    expect(classifyGroqError(error(429, minute429))).toEqual({
      kind: "minute",
      retryAfterMs: 62_500,
    });
  });

  it("prefers the retry-after header", () => {
    expect(
      classifyGroqError(new GroqError(429, "slow down", 3_000, null)),
    ).toEqual({ kind: "minute", retryAfterMs: 3_000 });
  });

  it("a 413 does not fit the link; a 5xx or 498 is busy", () => {
    expect(classifyGroqError(error(413, tooLarge413))).toEqual({
      kind: "too_large",
    });
    expect(classifyGroqError(new GroqError(503, "x", null, null))).toEqual({
      kind: "overloaded",
    });
    expect(classifyGroqError(new GroqError(498, "x", null, null))).toEqual({
      kind: "overloaded",
    });
    expect(classifyGroqError(new GroqError(401, "x", null, null))).toBe(null);
    expect(classifyGroqError(new Error("x"))).toBe(null);
  });
});

describe("Groq link of the chain", () => {
  it("parses a plan and sends a json_schema request", async () => {
    const t = setup([ok(planOk)]);
    const { output, calls } = await t.run();
    expect(output.tasks).toHaveLength(1);
    expect(calls).toEqual([
      expect.objectContaining({
        model: "groq:openai/gpt-oss-120b",
        kind: "first",
        inputTokens: 5300,
        outputTokens: 610,
        valid: true,
      }),
    ]);
    const body = t.bodies[0]!;
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages).toEqual([
      { role: "system", content: "sistema" },
      { role: "user", content: "petición" },
    ]);
    const format = body.response_format as {
      type: string;
      json_schema: { schema: Record<string, unknown>; strict: boolean };
    };
    expect(format.type).toBe("json_schema");
    expect(format.json_schema.strict).toBe(false);
    expect(format.json_schema.schema.$schema).toBeUndefined();
    expect(format.json_schema.schema.type).toBe("object");
    // The output budget is what is left of the 8K tokens per minute.
    expect(body.max_completion_tokens).toBeLessThan(8_000);
    expect(body.max_completion_tokens).toBeGreaterThanOrEqual(1_024);
  });

  it("json_validate_failed goes to the repair call with the failed JSON", async () => {
    const t = setup([{ status: 400, body: jsonValidate }, ok(planOk)]);
    const { calls } = await t.run();
    expect(calls.map((c) => [c.kind, c.valid])).toEqual([
      ["first", false],
      ["repair", true],
    ]);
    const messages = t.bodies[1]!.messages as {
      role: string;
      content: string;
    }[];
    expect(messages.map((m) => m.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
    expect(messages[3]!.content).toContain("Un plan viable tiene de 1 a 4");
  });

  it("a cut answer is OutputTruncated, without repair", async () => {
    const t = setup([ok(planLength)]);
    await expect(t.run()).rejects.toBeInstanceOf(OutputTruncated);
    expect(t.fetch).toHaveBeenCalledTimes(1);
  });

  it("a per-minute 429 postpones; a daily one marks the link", async () => {
    const minute = setup([
      { status: 429, body: minute429, headers: { "retry-after": "63" } },
    ]);
    await expect(minute.run()).rejects.toMatchObject({
      constructor: RateLimited,
      retryAfterMs: 63_000,
    });

    const daily = setup([{ status: 429, body: daily429 }]);
    await expect(daily.run()).rejects.toBeInstanceOf(QuotaExhausted);
    expect([...daily.marked]).toEqual(["groq:openai/gpt-oss-120b"]);
  });

  it("a request that cannot fit 8K tokens per minute is never sent", async () => {
    const t = setup([ok(planOk)], { prompt: "x".repeat(40_000) });
    const error = await t.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExhausted);
    expect((error as QuotaExhausted).reasons[0]).toContain(
      "no cabe en 8000 tokens por minuto",
    );
    expect(t.fetch).not.toHaveBeenCalled();
  });
});

describe("Gemini then Groq (D36)", () => {
  it("falls back to Groq when every Gemini model is out of quota", async () => {
    const t = setup([ok(planOk)]);
    const generate = vi.fn(async () => geminiPlanOk as GeminiResponse);
    const quota: QuotaMemory = {
      isExhausted: async (id) => id.startsWith("gemini:"),
      markExhausted: async () => {},
    };
    const provider = new ChainProvider({
      links: [new GeminiClient("flash", generate), t.client],
      quota,
      settings: AGENT_SETTINGS.orchestrator,
    });
    const { calls } = await provider.generateObject({
      agent: "orchestrator",
      system: "sistema",
      prompt: "petición",
      input: null,
      schema: planSchema,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(calls.map((c) => c.model)).toEqual(["groq:openai/gpt-oss-120b"]);
  });

  it("a 413 from Groq moves on to the next link", async () => {
    const t = setup([{ status: 413, body: tooLarge413 }]);
    const generate = vi.fn(async () => geminiPlanOk as GeminiResponse);
    const provider = new ChainProvider({
      links: [t.client, new GeminiClient("flash", generate)],
      quota: { isExhausted: async () => false, markExhausted: async () => {} },
      settings: AGENT_SETTINGS.orchestrator,
    });
    const { calls } = await provider.generateObject({
      agent: "orchestrator",
      system: "sistema",
      prompt: "petición",
      input: null,
      schema: planSchema,
    });
    expect(calls.map((c) => c.model)).toEqual(["gemini:flash"]);
  });
});

describe("recorded answers of pnpm eval:plan with Groq (D30, D36)", () => {
  const recorded = import.meta.glob<unknown>(
    "./fixtures/groq/recorded/plan-*.json",
    {
      eager: true,
      import: "default",
    },
  );
  // H4/H5 recordings are in recorded/h5: they predate testIds (D38).
  if (Object.keys(recorded).length === 0)
    it.skip("no recordings yet", () => {});

  it.each(Object.entries(recorded))(
    "%s parses as a feasible plan",
    async (_, body) => {
      const { output, calls } = await setup([ok(body)]).run();
      expect(output.feasible).toBe(true);
      expect(output.tasks.length).toBeGreaterThanOrEqual(1);
      expect(calls[0]!.valid).toBe(true);
    },
  );
});

describe("recorded steps of pnpm eval:testing with Groq (D38, D40)", () => {
  const recorded = import.meta.glob<unknown>(
    "./fixtures/groq/recorded/steps-*.json",
    { eager: true, import: "default" },
  );
  if (Object.keys(recorded).length === 0)
    it.skip("no recordings yet", () => {});

  it.each(Object.entries(recorded))(
    "%s passes the steps contract",
    async (_, body) => {
      const provider = new ChainProvider({
        links: [
          new GroqClient("openai/gpt-oss-120b", {
            apiKey: "test",
            fetch: async () => new Response(JSON.stringify(body)),
          }),
        ],
        quota: {
          isExhausted: async () => false,
          markExhausted: async () => {},
        },
        settings: AGENT_SETTINGS.testing,
      });
      const { output } = await provider.generateObject({
        agent: "testing",
        system: "sistema",
        prompt: "criterios",
        input: null,
        schema: stepsSchema,
      });
      expect(output.criteria.length).toBeGreaterThanOrEqual(1);
      for (const c of output.criteria) expect(c.steps[0]!.action).toBe("goto");
    },
  );
});
