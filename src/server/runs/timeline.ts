/**
 * Timeline of /runs/[id] without noise (D44): the agent of each event for
 * the filter, the retries grouped and a separator per iteration. Pure, with
 * the context comparison the engine uses before logging what Develop reads.
 */

import type { CardAgent } from "./agent-cards";

// --- Context logged only when it changes ---

type ContextData = {
  taskId?: unknown;
  iteration?: unknown;
  sha?: unknown;
  files?: unknown;
  trimmed?: unknown;
  newFiles?: unknown;
};

const signature = (d: ContextData) =>
  JSON.stringify([
    d.taskId,
    d.iteration,
    d.sha,
    d.files,
    d.trimmed,
    d.newFiles,
  ]);

/**
 * True when Develop read the same files as the last logged context of that
 * task and iteration: a resumed step (saturation, lease) logs nothing.
 */
export function sameContext(previous: unknown, next: ContextData): boolean {
  if (!previous || typeof previous !== "object") return false;
  return signature(previous as ContextData) === signature(next);
}

// --- Filter by agent ---

export const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "orquestador", label: "Orquestador", agent: "orchestrator" },
  { id: "develop", label: "Develop", agent: "develop" },
  { id: "testing", label: "Testing", agent: "testing" },
  { id: "humano", label: "Humano", agent: "human" },
] as const satisfies readonly {
  id: string;
  label: string;
  agent?: CardAgent;
}[];

export type FilterId = (typeof FILTERS)[number]["id"];

export function parseFilter(value: string | string[] | undefined): FilterId {
  const v = Array.isArray(value) ? value[0] : value;
  return FILTERS.some((f) => f.id === v) ? (v as FilterId) : "todos";
}

/**
 * The agent an event belongs to. The waits for GitHub and Vercel go to the
 * agent that waits for them, with the rule of D42: pr-check to Develop,
 * the preview and its E2E report to Testing.
 */
export function eventAgent(e: {
  actor: string;
  kind: string;
}): CardAgent | null {
  switch (e.actor) {
    case "orchestrator":
    case "develop":
    case "testing":
    case "human":
      return e.actor;
  }
  switch (e.kind) {
    case "check_passed":
    case "check_failed":
    case "pushed":
    case "format":
    case "simulation":
      return "develop";
    case "preview":
    case "report":
    case "build_failed":
    case "deploy_failure":
      return "testing";
    case "started":
    case "split":
    case "infeasible":
      return "orchestrator";
    case "merged":
    case "cleanup":
      return "human";
  }
  return null;
}

// --- Grouping ---

/** Postponed steps: every one is kept, the UI shows them as one line. */
const RETRY_KINDS = new Set(["overloaded", "rate_limited"]);

export type TimelineEvent = {
  id: number;
  actor: string;
  kind: string;
  message: string;
  data: unknown;
  at: Date;
};

export type TimelineItem<E extends TimelineEvent = TimelineEvent> =
  | { kind: "event"; event: E }
  | { kind: "retries"; events: E[]; first: Date; last: Date }
  | { kind: "iteration"; iteration: number; revision: number };

/** Iteration of the task Develop reads for, from a context event. */
function iterationOf(e: TimelineEvent): number | null {
  if (e.actor !== "develop" || e.kind !== "context") return null;
  const it = (e.data as { iteration?: unknown } | null)?.iteration;
  return typeof it === "number" ? it : null;
}

/**
 * Filters by agent, groups consecutive retries of the same kind (they are
 * all stored) and puts a separator where a Develop–Testing round starts:
 * each iteration, counted again after every plan of the Orchestrator.
 */
export function timelineItems<E extends TimelineEvent>(
  events: readonly E[],
  filter: FilterId,
): TimelineItem<E>[] {
  const wanted = FILTERS.find((f) => f.id === filter);
  const agent = wanted && "agent" in wanted ? wanted.agent : null;
  const rounds = agent === null || agent === "develop" || agent === "testing";
  const items: TimelineItem<E>[] = [];
  let revision = 0;
  let round = 0;
  for (const e of events) {
    if (e.actor === "orchestrator" && e.kind === "plan") {
      revision += 1;
      round = 0;
    }
    const iteration = iterationOf(e);
    if (rounds && iteration !== null && iteration !== round) {
      round = iteration;
      items.push({
        kind: "iteration",
        iteration,
        revision: Math.max(revision, 1),
      });
    }
    const retry = RETRY_KINDS.has(e.kind);
    // A postponed step has no agent of its own: it shows only in "Todos".
    if (agent && (retry || eventAgent(e) !== agent)) continue;
    if (retry) {
      const last = items.at(-1);
      if (last?.kind === "retries" && last.events[0]!.kind === e.kind) {
        last.events.push(e);
        last.last = e.at;
        continue;
      }
      items.push({ kind: "retries", events: [e], first: e.at, last: e.at });
      continue;
    }
    items.push({ kind: "event", event: e });
  }
  return items;
}
