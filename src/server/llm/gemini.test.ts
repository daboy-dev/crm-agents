import { ApiError, type GenerateContentParameters } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import { planSchema } from "@/server/agents/contracts";
import {
  AGENT_SETTINGS,
  ChainProvider,
  type AgentSettings,
  type QuotaMemory,
} from "./chain";
import {
  classifyQuotaError,
  GeminiClient,
  toGeminiSchema,
  type GeminiResponse,
} from "./gemini";
import daily429 from "./fixtures/gemini/error-429-daily.json";
import minute429 from "./fixtures/gemini/error-429-minute.json";
import thinking400 from "./fixtures/gemini/error-400-thinking.json";
import developMaxTokens from "./fixtures/gemini/develop-max-tokens.json";
import planInfeasible from "./fixtures/gemini/plan-infeasible.json";
import planInvalid from "./fixtures/gemini/plan-invalid.json";
import planOk from "./fixtures/gemini/plan-ok.json";
import planTruncated from "./fixtures/gemini/plan-truncated.json";
import {
  InvalidOutput,
  OutputTruncated,
  QuotaExhausted,
  RateLimited,
  type CallMeta,
} from "./provider";

// Recorded answers only: nothing here calls Gemini (D30).

const apiError = (body: unknown) =>
  new ApiError({ message: JSON.stringify(body), status: 429 });

type Step = GeminiResponse | Error;

function setup(
  steps: Step[],
  exhausted: string[] = [],
  options: { models?: string[]; settings?: AgentSettings } = {},
) {
  const queue = [...steps];
  const requests: GenerateContentParameters[] = [];
  const marked = new Set(exhausted);
  const quota: QuotaMemory = {
    isExhausted: async (m) => marked.has(m),
    markExhausted: async (m) => void marked.add(m),
  };
  const generate = vi.fn(async (params: GenerateContentParameters) => {
    requests.push(params);
    const next = queue.shift();
    if (!next) throw new Error("unexpected call");
    if (next instanceof Error) throw next;
    return next;
  });
  const models = options.models ?? ["flash-a", "flash-b", "lite"];
  const provider = new ChainProvider({
    links: models.map((m) => new GeminiClient(m, generate)),
    quota,
    settings: options.settings ?? AGENT_SETTINGS.orchestrator,
  });
  const counted: CallMeta[] = [];
  const before = vi.fn(async () => {});
  const run = () =>
    provider.generateObject({
      agent: "orchestrator",
      system: "sistema",
      prompt: "petición",
      input: null,
      schema: planSchema,
      hooks: { beforeCall: before, onCall: async (c) => void counted.push(c) },
    });
  return { run, requests, counted, before, marked };
}

describe("toGeminiSchema", () => {
  it("keeps the structure and drops what responseJsonSchema rejects", () => {
    const schema = toGeminiSchema(planSchema) as Record<string, unknown>;
    const text = JSON.stringify(schema);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual([
      "feasible",
      "summary",
      "assumptions",
      "tasks",
    ]);
    expect(text).toContain('"maxItems":4');
    expect(text).toContain('"enum":["e2e","visual"]');
    expect(text).not.toMatch(/minLength|maxLength|pattern|\$schema/);
  });
});

describe("classifyQuotaError", () => {
  it("reads the per-minute retry delay", () => {
    expect(classifyQuotaError(apiError(minute429))).toEqual({
      kind: "minute",
      retryAfterMs: 37_000,
    });
  });

  it("tells a daily quota by its quota id", () => {
    expect(classifyQuotaError(apiError(daily429))).toEqual({ kind: "daily" });
  });

  it("ignores other errors and falls back to a minute", () => {
    expect(
      classifyQuotaError(new ApiError({ message: "x", status: 500 })),
    ).toBe(null);
    expect(classifyQuotaError(new Error("boom"))).toBe(null);
    expect(
      classifyQuotaError(new ApiError({ message: "not json", status: 429 })),
    ).toEqual({ kind: "minute", retryAfterMs: 60_000 });
  });
});

describe("Gemini links of the chain", () => {
  it("parses a valid plan and records model, tokens and latency", async () => {
    const t = setup([planOk]);
    const { output, calls } = await t.run();
    expect(output.tasks).toHaveLength(2);
    expect(calls).toEqual([
      expect.objectContaining({
        model: "gemini:flash-a",
        kind: "first",
        inputTokens: 1800,
        outputTokens: 420,
        valid: true,
      }),
    ]);
    expect(t.counted).toEqual(calls);
    expect(t.before).toHaveBeenCalledTimes(1);

    const config = t.requests[0]!.config!;
    expect(t.requests[0]!.model).toBe("flash-a");
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseJsonSchema).toBeTruthy();
    expect(config.systemInstruction).toBe("sistema");
    expect(config.thinkingConfig?.thinkingLevel).toBe("MINIMAL");
    expect(config.maxOutputTokens).toBe(16_384);
    expect(config.httpOptions).toEqual({
      timeout: 60_000,
      retryOptions: { attempts: 1 },
    });
  });

  it("repairs once with the Zod errors, and both calls count", async () => {
    const t = setup([planInvalid, planOk]);
    const { output, calls } = await t.run();
    expect(output.tasks).toHaveLength(2);
    expect(calls.map((c) => [c.kind, c.valid])).toEqual([
      ["first", false],
      ["repair", true],
    ]);
    expect(t.counted).toHaveLength(2);
    expect(t.before).toHaveBeenCalledTimes(2);
    const repair = JSON.stringify(t.requests[1]!.contents);
    expect(repair).toContain("El id de criterio c1 está repetido");
    expect(repair).toContain(".github/workflows/ci.yml");
  });

  it("fails after a single repair that does not validate", async () => {
    const t = setup([planTruncated, planInvalid]);
    const error = await t.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidOutput);
    expect((error as InvalidOutput).calls).toHaveLength(2);
    expect(t.counted).toHaveLength(2);
    expect(t.requests).toHaveLength(2);
  });

  it("accepts a not feasible plan", async () => {
    const { output } = await setup([planInfeasible]).run();
    expect(output.feasible).toBe(false);
    expect(output.rejectionReason).toContain(".github/");
    expect(output.tasks).toEqual([]);
  });

  it("a per-minute 429 is thrown as RateLimited without trying more models", async () => {
    const t = setup([apiError(minute429)]);
    const error = await t.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimited);
    expect(error).toMatchObject({
      model: "gemini:flash-a",
      retryAfterMs: 37_000,
    });
    expect(t.requests).toHaveLength(1);
    expect(t.counted).toHaveLength(0);
    expect(t.marked.size).toBe(0);
  });

  it("a daily 429 moves to the next model and remembers the exhausted one", async () => {
    const t = setup([apiError(daily429), planOk]);
    const { calls } = await t.run();
    expect(t.requests.map((r) => r.model)).toEqual(["flash-a", "flash-b"]);
    expect(calls.map((c) => c.model)).toEqual(["gemini:flash-b"]);
    expect(t.counted).toHaveLength(1);
    expect([...t.marked]).toEqual(["gemini:flash-a"]);
  });

  it("a 503 tries the next model without marking it exhausted", async () => {
    const busy = new ApiError({ message: "high demand", status: 503 });
    const t = setup([busy, planOk]);
    const { calls } = await t.run();
    expect(calls.map((c) => c.model)).toEqual(["gemini:flash-b"]);
    expect(t.marked.size).toBe(0);

    // Every model busy: the step fails and the sweep retries it later.
    const all = setup([busy, busy, busy]);
    await expect(all.run()).rejects.toBe(busy);
  });

  it("skips models already exhausted today", async () => {
    const t = setup([planOk], ["gemini:flash-a", "gemini:flash-b"]);
    await t.run();
    expect(t.requests.map((r) => r.model)).toEqual(["lite"]);
  });

  it("throws QuotaExhausted when no model is left", async () => {
    const t = setup([apiError(daily429)], ["gemini:flash-a", "gemini:flash-b"]);
    const error = await t.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExhausted);
    expect((error as Error).message).toContain("se renueva a las 9:00");
    expect((error as QuotaExhausted).reasons).toHaveLength(3);
    expect([...t.marked]).toEqual([
      "gemini:flash-a",
      "gemini:flash-b",
      "gemini:lite",
    ]);
  });

  it("falls back to LOW when the model refuses MINIMAL thinking", async () => {
    // A model of its own: the accepted level is remembered per model.
    const t = setup(
      [
        new ApiError({ message: JSON.stringify(thinking400), status: 400 }),
        planOk,
        planOk,
      ],
      [],
      { models: ["no-minimal"] },
    );
    const { calls } = await t.run();
    expect(calls).toHaveLength(1);
    expect(t.counted).toHaveLength(1);
    expect(
      t.requests.map((r) => r.config?.thinkingConfig?.thinkingLevel),
    ).toEqual(["MINIMAL", "LOW"]);
    // Remembered for the model: the next call goes straight to LOW.
    await t.run();
    expect(t.requests[2]!.config?.thinkingConfig?.thinkingLevel).toBe("LOW");
  });

  it("Develop starts at LOW thinking with 32K output tokens (D35)", async () => {
    const t = setup([planOk], [], {
      models: ["dev"],
      settings: AGENT_SETTINGS.develop,
    });
    await t.run();
    const config = t.requests[0]!.config!;
    expect(config.thinkingConfig?.thinkingLevel).toBe("LOW");
    expect(config.maxOutputTokens).toBe(32_768);
    expect(config.httpOptions?.timeout).toBe(150_000);
  });

  it("a MAX_TOKENS answer is not repaired: OutputTruncated (D34)", async () => {
    const t = setup([developMaxTokens, planOk]);
    const error = await t.run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OutputTruncated);
    expect(error).toMatchObject({ model: "gemini:flash-a" });
    // The cut answer counts in LLM_CALLS_PER_RUN; no second request.
    expect(t.requests).toHaveLength(1);
    expect(t.counted).toEqual([
      expect.objectContaining({ valid: false, outputTokens: 32_768 }),
    ]);
    expect((error as OutputTruncated).calls).toHaveLength(1);
  });

  it("does not call the model when the budget hook refuses", async () => {
    const t = setup([planOk]);
    t.before.mockRejectedValueOnce(new Error("over budget"));
    await expect(t.run()).rejects.toThrow("over budget");
    expect(t.requests).toHaveLength(0);
  });
});

describe("recorded answers of pnpm eval:plan (D30)", () => {
  const recorded = import.meta.glob<GeminiResponse>(
    "./fixtures/gemini/recorded/*.json",
    { eager: true, import: "default" },
  );

  it.each(Object.entries(recorded))(
    "%s parses as a feasible plan",
    async (_, r) => {
      const t = setup([r]);
      const { output } = await t.run();
      expect(output.feasible).toBe(true);
      expect(output.tasks.length).toBeGreaterThanOrEqual(1);
      expect(output.tasks.length).toBeLessThanOrEqual(4);
    },
  );
});
