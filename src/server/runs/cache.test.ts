import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CallHooks, CallMeta } from "@/server/llm/provider";
import {
  cachedCall,
  CallLimitReached,
  totals,
  type StepKey,
  type StepStore,
  type StoredStep,
} from "./cache";

const schema = z.object({ answer: z.string() });
const key: StepKey = { agent: "orchestrator", taskId: null, iteration: 1 };

const meta = (over: Partial<CallMeta> = {}): CallMeta => ({
  model: "gemini-3.8-flash",
  kind: "first",
  inputTokens: 1000,
  outputTokens: 200,
  latencyMs: 3000,
  valid: true,
  ...over,
});

function memoryStore(llmCalls = 0) {
  const rows = new Map<string, StoredStep>();
  const id = (k: StepKey) => `${k.agent}:${k.taskId}:${k.iteration}`;
  const state = { llmCalls, renewed: 0 };
  const store: StepStore = {
    find: async (k) => rows.get(id(k)) ?? null,
    insert: async (k, output, calls) => {
      if (rows.has(id(k))) return false;
      rows.set(id(k), { output, calls });
      return true;
    },
    countCall: async () => ++state.llmCalls,
    renewLease: async () => void state.renewed++,
  };
  return { store, state, rows };
}

/** A provider that answers after the given number of requests. */
const fakeModel = (requests: CallMeta[]) =>
  vi.fn(async (hooks: CallHooks) => {
    for (const c of requests) {
      await hooks.beforeCall?.();
      await hooks.onCall?.(c);
    }
    return { output: { answer: "sí" }, calls: requests };
  });

describe("cachedCall (D22, D26)", () => {
  it("calls the model once and serves the stored output afterwards", async () => {
    const { store, state } = memoryStore();
    const call = fakeModel([meta()]);
    const first = await cachedCall({
      store,
      key,
      schema,
      used: 0,
      limit: 12,
      call,
    });
    expect(first).toMatchObject({ output: { answer: "sí" }, cached: false });
    expect(state.llmCalls).toBe(1);

    // A repeated step (crash, expired lease, double click) does not call again.
    const again = await cachedCall({
      store,
      key,
      schema,
      used: 1,
      limit: 12,
      call,
    });
    expect(again).toMatchObject({ output: { answer: "sí" }, cached: true });
    expect(again.calls).toEqual([meta()]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(state.llmCalls).toBe(1);
  });

  it("counts the repair call and renews the lease before each request", async () => {
    const { store, state } = memoryStore(3);
    await cachedCall({
      store,
      key,
      schema,
      used: 3,
      limit: 12,
      call: fakeModel([meta({ valid: false }), meta({ kind: "repair" })]),
    });
    expect(state.llmCalls).toBe(5);
    expect(state.renewed).toBe(2);
  });

  it("stops before the request that would pass the limit", async () => {
    const { store, state, rows } = memoryStore(11);
    const error = await cachedCall({
      store,
      key,
      schema,
      used: 11,
      limit: 12,
      call: fakeModel([meta({ valid: false }), meta({ kind: "repair" })]),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CallLimitReached);
    expect(state.llmCalls).toBe(12);
    expect(rows.size).toBe(0);
  });

  it("uses the output another attempt stored first", async () => {
    const { store, rows } = memoryStore();
    const call = vi.fn(async () => {
      rows.set("orchestrator:null:1", {
        output: { answer: "primero" },
        calls: [meta({ model: "other" })],
      });
      return { output: { answer: "segundo" }, calls: [meta()] };
    });
    const result = await cachedCall({
      store,
      key,
      schema,
      used: 0,
      limit: 12,
      call,
    });
    expect(result).toMatchObject({
      output: { answer: "primero" },
      cached: true,
    });
  });

  it("adds up the calls of a step", () => {
    expect(
      totals([meta({ valid: false }), meta({ kind: "repair", model: "lite" })]),
    ).toEqual({
      model: "lite",
      inputTokens: 2000,
      outputTokens: 400,
      latencyMs: 6000,
    });
  });
});
