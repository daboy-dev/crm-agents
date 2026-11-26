/**
 * Tasks and criteria of /runs/[id] (D43): each task with its commit, the
 * files it touched and its criteria, each with its result at 1280 and
 * 390 px, Testing's reason and the failed step. Pure; the page passes what
 * getRunDetail read.
 */

import type {
  CriteriaSteps,
  Criterion,
  CriterionResult,
  Step,
} from "@/server/agents/contracts";
import type { TestFailure } from "@/server/db/schema";
import { criterionKey } from "./criteria";

/** Playwright projects of crm-demo: 1280 px and 390 px. */
export const PROJECTS = [
  { id: "desktop", label: "1280 px" },
  { id: "mobile-390", label: "390 px" },
] as const;

export type Outcome = "pass" | "fail" | "pending";

export type CriterionView = {
  id: string;
  key: string;
  type: string;
  text: string;
  testIds: string[];
  /** One per project, in PROJECTS order; empty for a visual criterion. */
  results: { project: string; label: string; outcome: Outcome }[];
  outcome: Outcome | "manual";
  /** Testing's explanation (D39), only while the criterion fails. */
  reason: string | null;
  failedStep: string | null;
  error: string | null;
  /** Steps Testing wrote; Develop never sees them (D39). */
  steps: Step[];
};

export type TaskView = {
  id: number;
  position: number;
  title: string;
  description: string;
  status: string;
  iteration: number;
  maxIterations: number;
  commitSha: string | null;
  /** Files of the last commit; outside: not in the plan's list (D34). */
  touched: { path: string; outside: boolean }[];
  criteria: CriterionView[];
  lastFeedback: string | null;
};

/** Subtasks under the task they come from (D34). */
export type TaskGroup =
  | { kind: "task"; task: TaskView }
  | { kind: "split"; from: number; title: string; tasks: TaskView[] };

export type RegressionView = {
  title: string;
  outcome: "pass" | "fail";
  error: string | null;
};

export type TaskSection = {
  groups: TaskGroup[];
  /** Criteria of earlier runs and other E2E tests (D38). */
  regression: { passed: number; total: number; items: RegressionView[] };
  /** The results belong to the current head. */
  hasReport: boolean;
};

type Task = {
  id: number;
  position: number;
  title: string;
  description: string;
  status: string;
  iteration: number;
  maxIterations: number;
  commitSha: string | null;
  files: string[];
  acceptanceCriteria: Criterion[];
  lastFeedback: string | null;
  splitFrom: number | null;
};

type Event = { kind: string; data: unknown };

export type TaskViewInput = {
  runId: number;
  planRevision: number;
  /** Tasks of the current revision. */
  tasks: Task[];
  /** Titles of every task of the run, for the split groups. */
  titles: ReadonlyMap<number, string>;
  events: readonly Event[];
  /** Testing's steps of the current revision (D38). */
  steps: CriteriaSteps | null;
  /** Latest E2E report of the head. */
  report: { criteria: CriterionResult[]; failures: TestFailure[] } | null;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** Last commit of each task: files and the ones outside the plan. */
function lastCommits(events: readonly Event[]) {
  const byTask = new Map<number, { files: string[]; outside: string[] }>();
  for (const e of events) {
    if (e.kind !== "commit") continue;
    const d = obj(e.data);
    if (typeof d.taskId !== "number") continue;
    const strings = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    byTask.set(d.taskId, {
      files: strings(d.files),
      outside: strings(d.outsidePlan),
    });
  }
  return byTask;
}

/** Testing's latest reason for each criterion key (D39). */
function lastReasons(events: readonly Event[]) {
  const byKey = new Map<string, { reason: string; evidence: string }>();
  for (const e of events) {
    if (e.kind !== "explain") continue;
    const criteria = obj(e.data).criteria;
    if (!Array.isArray(criteria)) continue;
    for (const c of criteria) {
      const d = obj(c);
      if (typeof d.key === "string" && typeof d.reason === "string") {
        byKey.set(d.key, {
          reason: d.reason,
          evidence: typeof d.evidence === "string" ? d.evidence : "",
        });
      }
    }
  }
  return byKey;
}

function stepText(r: CriterionResult): string | null {
  if (!r.failedStep) return null;
  return `${r.failedStep.action} (en ${r.failedStep.url})`;
}

function criterionView(
  input: TaskViewInput,
  c: Criterion,
  reasons: Map<string, { reason: string; evidence: string }>,
): CriterionView {
  const key = criterionKey(input.planRevision, c.id);
  const steps = input.steps?.criteria.find((s) => s.id === c.id)?.steps ?? [];
  const base = {
    id: c.id,
    key,
    type: c.type,
    text: c.text,
    testIds: c.testIds ?? [],
    steps,
  };
  if (c.type !== "e2e") {
    return {
      ...base,
      results: [],
      outcome: "manual",
      reason: null,
      failedStep: null,
      error: null,
    };
  }
  const mine = (input.report?.criteria ?? []).filter(
    (r) => r.run === input.runId && r.key === key,
  );
  const results = PROJECTS.map((p) => {
    const r = mine.find((m) => m.project === p.id);
    const outcome: Outcome = !r ? "pending" : r.passed ? "pass" : "fail";
    return { project: p.id, label: p.label, outcome };
  });
  const worst = mine.find((r) => !r.passed) ?? null;
  const outcome: Outcome = worst
    ? "fail"
    : results.every((r) => r.outcome === "pass")
      ? "pass"
      : "pending";
  const explained = worst ? reasons.get(key) : undefined;
  return {
    ...base,
    results,
    outcome,
    reason: explained?.reason ?? null,
    failedStep: worst ? explained?.evidence || stepText(worst) : null,
    error: worst?.error ?? null,
  };
}

function regression(input: TaskViewInput): TaskSection["regression"] {
  const items = new Map<string, RegressionView>();
  for (const r of input.report?.criteria ?? []) {
    if (r.run === input.runId) continue;
    const title = `Run #${r.run} · ${r.key}`;
    const prev = items.get(title);
    if (!prev || (prev.outcome === "pass" && !r.passed)) {
      items.set(title, {
        title,
        outcome: r.passed ? "pass" : "fail",
        error: r.passed ? null : r.error,
      });
    }
  }
  // Other failing E2E tests (smoke, flows), not tied to a criterion.
  for (const f of input.report?.failures ?? []) {
    const name = f.title.split(" › ").at(-1) ?? f.title;
    if (/^run-[0-9]+ r[0-9]+ c[0-9]{1,2} · /.test(name)) continue;
    if (!items.has(f.title)) {
      items.set(f.title, { title: f.title, outcome: "fail", error: f.error });
    }
  }
  const list = [...items.values()].sort((a, b) =>
    a.outcome === b.outcome
      ? a.title.localeCompare(b.title)
      : a.outcome === "fail"
        ? -1
        : 1,
  );
  return {
    passed: list.filter((i) => i.outcome === "pass").length,
    total: list.length,
    items: list,
  };
}

export function taskSection(input: TaskViewInput): TaskSection {
  const commits = lastCommits(input.events);
  const reasons = lastReasons(input.events);
  const views = input.tasks.map((t): TaskView => {
    const commit = commits.get(t.id);
    return {
      id: t.id,
      position: t.position,
      title: t.title,
      description: t.description,
      status: t.status,
      iteration: t.iteration,
      maxIterations: t.maxIterations,
      commitSha: t.commitSha,
      touched: (commit?.files ?? []).map((path) => ({
        path,
        outside: commit!.outside.includes(path),
      })),
      criteria: t.acceptanceCriteria.map((c) =>
        criterionView(input, c, reasons),
      ),
      lastFeedback: t.lastFeedback,
    };
  });

  const groups: TaskGroup[] = [];
  for (const [i, view] of views.entries()) {
    const from = input.tasks[i]!.splitFrom;
    if (from === null) {
      groups.push({ kind: "task", task: view });
      continue;
    }
    const last = groups.at(-1);
    if (last?.kind === "split" && last.from === from) {
      last.tasks.push(view);
      continue;
    }
    const title = input.titles.get(from) ?? `Tarea ${from}`;
    groups.push({ kind: "split", from, title, tasks: [view] });
  }
  return {
    groups,
    regression: regression(input),
    hasReport: input.report !== null,
  };
}
