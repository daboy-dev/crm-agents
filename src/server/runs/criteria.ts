import type {
  CriteriaSteps,
  Criterion,
  CriterionResult,
  Step,
} from "@/server/agents/contracts";
import type { TestFailure } from "@/server/db/schema";

/**
 * Acceptance criteria of a run on the preview (D38, D39): the JSON the panel
 * commits for e2e/criteria.spec.ts, and the verdict read from its results.
 * Pure functions; the engine does the reading and the writing.
 */

export const criteriaPath = (runId: number) => `e2e/criteria/run-${runId}.json`;

/** Key of a criterion in the runner's titles: ids restart in an amend (D29). */
export const criterionKey = (revision: number, id: string) =>
  `r${revision}-${id}`;

type RevisionTask = {
  id: number;
  planRevision: number;
  position: number;
  acceptanceCriteria: Criterion[];
  splitFrom: number | null;
};

/**
 * Revisions whose criteria still count: every revision with steps, but not
 * one that a split replaced. A split copies the whole plan, criteria
 * included, into the next revision (D34), so its criteria would run twice.
 */
export function liveRevisions(
  tasks: readonly RevisionTask[],
  withSteps: readonly number[],
): number[] {
  const revisionOf = new Map(tasks.map((t) => [t.id, t.planRevision]));
  const replaced = new Set(
    tasks
      .filter((t) => t.splitFrom !== null)
      .map((t) => revisionOf.get(t.splitFrom!))
      .filter((r): r is number => r !== undefined),
  );
  return [...new Set(withSteps)]
    .filter((r) => !replaced.has(r))
    .sort((a, b) => a - b);
}

/** True when the revision was created by splitting the previous one (D34). */
export function isSplitRevision(
  tasks: readonly RevisionTask[],
  revision: number,
): boolean {
  const previous = new Set(
    tasks.filter((t) => t.planRevision === revision - 1).map((t) => t.id),
  );
  return tasks.some(
    (t) =>
      t.planRevision === revision &&
      t.splitFrom !== null &&
      previous.has(t.splitFrom),
  );
}

export type CriteriaFile = {
  run: number;
  criteria: {
    id: string;
    revision: number;
    task: number;
    text: string;
    steps: Step[];
  }[];
};

/**
 * The JSON of e2e/criteria/run-<id>.json from the stored steps of each live
 * revision. Stable output, so a retried step builds the same commit.
 */
export function buildCriteriaFile(
  runId: number,
  tasks: readonly RevisionTask[],
  steps: ReadonlyMap<number, CriteriaSteps>,
): string {
  const revisions = liveRevisions(tasks, [...steps.keys()]);
  const file: CriteriaFile = { run: runId, criteria: [] };
  for (const revision of revisions) {
    const byId = new Map(steps.get(revision)!.criteria.map((c) => [c.id, c]));
    const ordered = tasks
      .filter((t) => t.planRevision === revision)
      .sort((a, b) => a.position - b.position);
    for (const task of ordered) {
      for (const c of task.acceptanceCriteria) {
        const found = byId.get(c.id);
        if (!found) continue;
        file.criteria.push({
          id: c.id,
          revision,
          task: task.position,
          text: c.text,
          steps: found.steps,
        });
      }
    }
  }
  return JSON.stringify(file, null, 2) + "\n";
}

/** Names of e2e/pages.ts, read as text: the file is a list of literals. */
export function pageNames(source: string | null): string[] {
  if (!source) return [];
  return [...source.matchAll(/name:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]!);
}

export type CurrentCriterion = {
  key: string;
  taskId: number;
  task: number;
  text: string;
};

export type Judgement = {
  /** Worst result of each criterion of this revision, by key. */
  failed: (CriterionResult & { taskId: number; task: number; text: string })[];
  passed: string[];
  /** Failing tests that are not a criterion of this revision. */
  regressions: TestFailure[];
};

/**
 * Verdict of the runner (D39): a criterion passes only when its test passed
 * in every project. A criterion with no result fails: its test did not run.
 */
export function judge(
  runId: number,
  current: readonly CurrentCriterion[],
  results: readonly CriterionResult[],
  failures: readonly TestFailure[],
): Judgement {
  const mine = results.filter((r) => r.run === runId);
  const keys = new Set(current.map((c) => c.key));
  const judgement: Judgement = { failed: [], passed: [], regressions: [] };
  for (const c of current) {
    const runs = mine.filter((r) => r.key === c.key);
    const worst = runs.find((r) => !r.passed);
    if (runs.length > 0 && !worst) {
      judgement.passed.push(c.key);
      continue;
    }
    const [revision, criterion] = c.key.slice(1).split("-");
    judgement.failed.push({
      ...(worst ?? {
        key: c.key,
        run: runId,
        revision: Number(revision),
        criterion: criterion!,
        project: "",
        passed: false,
        error:
          "El test del criterio no ha corrido: revisa que e2e/criteria/run-<id>.json sea válido.",
        failedStep: null,
        snapshot: null,
      }),
      taskId: c.taskId,
      task: c.task,
      text: c.text,
    });
  }
  // Each failing criterion of this revision is already counted above.
  const own = (title: string) => {
    const match = /^run-([0-9]+) r([0-9]+) (c[0-9]{1,2}) · /.exec(
      title.split(" › ").at(-1) ?? "",
    );
    return (
      match !== null &&
      Number(match[1]) === runId &&
      keys.has(criterionKey(Number(match[2]), match[3]!))
    );
  };
  const seen = new Set<string>();
  for (const f of failures) {
    if (own(f.title) || seen.has(f.title)) continue;
    seen.add(f.title);
    judgement.regressions.push(f);
  }
  return judgement;
}

const MAX_FEEDBACK_SNAPSHOT = 1_500;

/**
 * What Develop reads in its next iteration (D39): the reason, the failed
 * step and part of the snapshot; never the list of steps.
 */
export function feedbackFor(
  failed: {
    key: string;
    criterion: string;
    reason: string;
    evidence: string;
    snapshot: string | null;
    url?: string;
  }[],
  regressions: { test: string; reason: string }[],
): string {
  const lines: string[] = [];
  if (failed.length > 0) {
    lines.push("Criterios que fallan en la vista previa:");
    for (const f of failed) {
      lines.push(`- ${f.criterion}: ${f.reason}`);
      if (f.evidence) lines.push(`  Paso que falla: ${f.evidence}`);
      if (f.snapshot) {
        lines.push(
          `  Árbol de accesibilidad de la página en ese momento${f.url ? ` (${f.url})` : ""}:`,
          "  ```yaml",
          ...f.snapshot
            .slice(0, MAX_FEEDBACK_SNAPSHOT)
            .split("\n")
            .map((l) => `  ${l}`),
          "  ```",
        );
      }
    }
  }
  if (regressions.length > 0) {
    lines.push("Tests que ya pasaban y ahora fallan:");
    for (const r of regressions) lines.push(`- ${r.test}: ${r.reason}`);
  }
  return lines.join("\n");
}
