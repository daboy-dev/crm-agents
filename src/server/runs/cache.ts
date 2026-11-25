import type { z } from "zod";
import type { AgentName } from "@/server/agents/contracts";
import { leaseSecondsFor } from "@/server/llm/chain";
import type { CallHooks, CallMeta, Generated } from "@/server/llm/provider";

/**
 * Cache of agent outputs (D22): the validated output of each LLM step is
 * stored by (run, task, iteration, agent), so a retried step never calls the
 * model again. Every answered request counts in LLM_CALLS_PER_RUN (D26).
 */

export type StepKey = {
  agent: AgentName;
  taskId: number | null;
  iteration: number;
  /** A second kind of call of the same agent (Testing, D38 and D39). */
  scope?: string;
};

export type StoredStep = { output: unknown; calls: CallMeta[] | null };

/** Persistence of the cache; agent_steps and runs.llm_calls in the app. */
export interface StepStore {
  find(key: StepKey): Promise<StoredStep | null>;
  /** Returns false when another attempt stored the key first. */
  insert(key: StepKey, output: unknown, calls: CallMeta[]): Promise<boolean>;
  /** Adds one call to the run and returns the new total. */
  countCall(): Promise<number>;
  /**
   * Extends the step's lease before a request, past its timeout, so the
   * sweep never starts the same call in parallel (D35).
   */
  renewLease(seconds: number): Promise<void>;
}

export class CallLimitReached extends Error {
  constructor(readonly limit: number) {
    super(`Se ha llegado al máximo de ${limit} llamadas al LLM del run`);
  }
}

export type CachedResult<T> = {
  output: T;
  calls: CallMeta[];
  /** Read from agent_steps: the model was not called. */
  cached: boolean;
};

/** Sum of the calls of one step, as stored in the agent_steps columns. */
export function totals(calls: CallMeta[]) {
  return {
    model: calls.at(-1)?.model ?? null,
    inputTokens: calls.reduce((n, c) => n + c.inputTokens, 0),
    outputTokens: calls.reduce((n, c) => n + c.outputTokens, 0),
    latencyMs: calls.reduce((n, c) => n + c.latencyMs, 0),
  };
}

export async function cachedCall<T>(options: {
  store: StepStore;
  key: StepKey;
  schema: z.ZodType<T>;
  /** Calls the run has made so far, and its limit. */
  used: number;
  limit: number;
  call: (hooks: CallHooks) => Promise<Generated<T>>;
}): Promise<CachedResult<T>> {
  const { store, key, schema, limit } = options;
  const stored = await store.find(key);
  if (stored) {
    return {
      output: schema.parse(stored.output),
      calls: stored.calls ?? [],
      cached: true,
    };
  }

  let used = options.used;
  const { output, calls } = await options.call({
    beforeCall: async () => {
      if (used >= limit) throw new CallLimitReached(limit);
      await store.renewLease(leaseSecondsFor(key.agent));
    },
    onCall: async () => {
      used = await store.countCall();
    },
  });
  if (await store.insert(key, output, calls)) {
    return { output, calls, cached: false };
  }
  // Another attempt stored it first: use that one.
  const winner = await store.find(key);
  return {
    output: schema.parse(winner!.output),
    calls: winner!.calls ?? [],
    cached: true,
  };
}
