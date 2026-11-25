/**
 * Run and task state machine (D21). Pure: no I/O, so every transition is
 * covered by a table test. The engine persists the result with a
 * compare-and-swap on the run version (D22).
 */

export const RUN_STATUSES = [
  "queued",
  "planning",
  "awaiting_plan_approval",
  "developing",
  /** pr-check of the pushed head: migration, types and lint (D31, D33). */
  "awaiting_check",
  "awaiting_preview",
  "testing",
  "awaiting_final_approval",
  "merging",
  "blocked",
  "done",
  "rejected",
  "cancelled",
  "failed",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const FINAL_STATUSES: readonly RunStatus[] = [
  "done",
  "rejected",
  "cancelled",
  "failed",
];

/** Statuses in which the server has work to do (a step run under a lease). */
export const STEP_STATUSES: readonly RunStatus[] = [
  "planning",
  "developing",
  "testing",
  "merging",
];

export const AWAITING_HUMAN: readonly RunStatus[] = [
  "awaiting_plan_approval",
  "awaiting_final_approval",
];

export type TaskStatus =
  | "pending"
  | "developing"
  | "testing"
  | "passed"
  | "failed"
  | "blocked"
  /** Final: replaced by its subtasks in the next revision (D34). */
  | "split";

export type TaskState = {
  id: number;
  status: TaskStatus;
  iteration: number;
  maxIterations: number;
};

export type RunState = {
  status: RunStatus;
  /** Tasks of the current plan revision. */
  tasks: TaskState[];
  blockedFrom: RunStatus | null;
  /** The branch exists (or may exist): leaving the run must delete it. */
  hasBranch: boolean;
};

export type Verdict = { taskId: number; passed: boolean; feedback: string };

export type RunEvent =
  | { type: "start" }
  | { type: "plan_ready" }
  /** The orchestrator found the request out of scope (D28). */
  | { type: "plan_infeasible"; reason: string }
  | { type: "approve_plan" }
  | { type: "reject"; feedback: string | null }
  | { type: "develop_done" }
  /** No task of the iteration changed a file: nothing to push (D34). */
  | { type: "develop_unchanged" }
  /** Develop's answer was cut: the orchestrator splits the task (D34). */
  | { type: "task_too_large"; taskId: number; reason: string }
  /** The subtasks replace the task, without a new approval (D34). */
  | { type: "split_ready" }
  | { type: "forbidden"; taskId: number; reason: string }
  | { type: "check_passed" }
  /** pr-check found errors: they go back to Develop (D33). */
  | { type: "check_failed"; feedback: string }
  | { type: "check_timeout" }
  | { type: "build_failed" }
  | { type: "report_ready" }
  | { type: "testing_done"; verdicts: Verdict[] }
  | { type: "approve_final" }
  | { type: "merged" }
  | { type: "pr_closed" }
  | { type: "retry" }
  | { type: "cancel" }
  | { type: "preview_timeout" }
  | { type: "approval_timeout" }
  /** A step cannot go on (limit reached, branch moved, PR not mergeable). */
  | { type: "block"; reason: string }
  | { type: "step_failed"; reason: string };

export type TaskChange = {
  id: number;
  status: TaskStatus;
  iteration?: number;
  maxIterations?: number;
  lastFeedback?: string | null;
};

export type Effect =
  /** Run the step of the new status (planning, developing, testing, merging). */
  | { type: "run_step" }
  /** Close the PR and delete the branch (D11). */
  | { type: "cleanup" }
  /** The active slot is free: start the oldest queued run (D23). */
  | { type: "start_next" }
  /**
   * The preview or its report may have arrived before the run was waiting
   * for it (the webhook found no run): look for them now.
   */
  | { type: "check_preview" }
  /** Same for the result of pr-check (D33). */
  | { type: "check_pr" };

export type Transition = {
  status: RunStatus;
  tasks: TaskChange[];
  effects: Effect[];
  /** Set when entering blocked; cleared otherwise. */
  blockedFrom: RunStatus | null;
  blockedReason: string | null;
  /** Client feedback that sends the run back to planning (D9). */
  replan: { feedback: string } | null;
  /** A task to split in the next revision (D34). */
  split: { taskId: number; reason: string } | null;
};

export const isFinal = (s: RunStatus) => FINAL_STATUSES.includes(s);
export const isStep = (s: RunStatus) => STEP_STATUSES.includes(s);

/** Effects implied by entering a status. */
function effectsFor(to: RunStatus, from: RunState): Effect[] {
  if (isStep(to)) return [{ type: "run_step" }];
  if (to === "awaiting_preview") return [{ type: "check_preview" }];
  if (to === "awaiting_check") return [{ type: "check_pr" }];
  if (isFinal(to)) {
    const effects: Effect[] = [{ type: "start_next" }];
    if (to !== "done" && from.hasBranch) effects.unshift({ type: "cleanup" });
    return effects;
  }
  return [];
}

function result(
  from: RunState,
  to: RunStatus,
  extra: Partial<Omit<Transition, "status" | "effects">> = {},
): Transition {
  return {
    status: to,
    tasks: [],
    blockedFrom: null,
    blockedReason: null,
    replan: null,
    split: null,
    ...extra,
    effects: effectsFor(to, from),
  };
}

function blocked(
  from: RunState,
  reason: string,
  tasks: TaskChange[] = [],
): Transition {
  return result(from, "blocked", {
    tasks,
    blockedFrom: from.status,
    blockedReason: reason,
  });
}

/**
 * Tasks that failed go back to Develop for one more iteration, or are blocked
 * when they reach their limit (D5). Returns the run transition.
 */
function afterFailures(from: RunState, failed: Verdict[]): Transition {
  const changes: TaskChange[] = [];
  let anyBlocked = false;
  for (const verdict of failed) {
    const task = from.tasks.find((t) => t.id === verdict.taskId);
    if (!task) continue;
    if (task.iteration >= task.maxIterations) {
      anyBlocked = true;
      changes.push({
        id: task.id,
        status: "blocked",
        lastFeedback: verdict.feedback,
      });
    } else {
      changes.push({
        id: task.id,
        status: "developing",
        iteration: task.iteration + 1,
        lastFeedback: verdict.feedback,
      });
    }
  }
  if (anyBlocked) {
    // Tasks still under their limit wait as failed until the human decides.
    const settled = changes.map((c) =>
      c.status === "developing"
        ? { id: c.id, status: "failed" as const, lastFeedback: c.lastFeedback }
        : c,
    );
    return blocked(
      from,
      "Una tarea ha llegado al máximo de iteraciones",
      settled,
    );
  }
  return result(from, "developing", { tasks: changes });
}

/** Every task in a status fails with the same feedback. */
const failing = (
  run: RunState,
  status: TaskStatus,
  feedback: string,
): Verdict[] =>
  run.tasks
    .filter((t) => t.status === status)
    .map((t) => ({ taskId: t.id, passed: false, feedback }));

/**
 * Computes the next state. Returns null when the event does not apply to the
 * current status: the caller treats it as a no-op (D22).
 */
export function transition(run: RunState, event: RunEvent): Transition | null {
  const s = run.status;
  if (isFinal(s)) return null;

  switch (event.type) {
    case "start":
      return s === "queued" ? result(run, "planning") : null;

    case "plan_ready":
      return s === "planning" ? result(run, "awaiting_plan_approval") : null;

    case "plan_infeasible":
      // No branch yet on a first plan; after a preview the cleanup closes the PR.
      return s === "planning" ? result(run, "rejected") : null;

    case "approve_plan":
      if (s !== "awaiting_plan_approval") return null;
      if (run.tasks.length === 0) return null;
      return result(run, "developing", {
        tasks: run.tasks.map((t) => ({
          id: t.id,
          status: "developing",
          iteration: 1,
        })),
      });

    case "reject": {
      if (!AWAITING_HUMAN.includes(s)) return null;
      const feedback = event.feedback?.trim();
      if (feedback) return result(run, "planning", { replan: { feedback } });
      return result(run, "rejected");
    }

    case "develop_done":
      if (s !== "developing") return null;
      // pr-check runs before the preview counts (D31, D33).
      return result(run, "awaiting_check", {
        tasks: run.tasks
          .filter((t) => t.status === "developing")
          .map((t) => ({ id: t.id, status: "testing" })),
      });

    case "develop_unchanged":
      if (s !== "developing") return null;
      return afterFailures(
        run,
        failing(run, "developing", "Develop no cambió nada"),
      );

    case "task_too_large": {
      if (s !== "developing") return null;
      if (!run.tasks.some((t) => t.id === event.taskId)) return null;
      return result(run, "planning", {
        tasks: [{ id: event.taskId, status: "split" }],
        split: { taskId: event.taskId, reason: event.reason },
      });
    }

    case "split_ready":
      if (s !== "planning") return null;
      if (!run.tasks.some((t) => t.status === "developing")) return null;
      return result(run, "developing");

    case "check_passed":
      return s === "awaiting_check" ? result(run, "awaiting_preview") : null;

    case "check_failed":
      if (s !== "awaiting_check") return null;
      return afterFailures(run, failing(run, "testing", event.feedback));

    case "check_timeout":
      return s === "awaiting_check"
        ? blocked(run, "La comprobación del PR no ha llegado en 15 minutos")
        : null;

    case "forbidden":
      if (s !== "developing") return null;
      return blocked(run, event.reason, [
        { id: event.taskId, status: "blocked", lastFeedback: event.reason },
      ]);

    case "build_failed":
      if (s !== "awaiting_preview") return null;
      return afterFailures(
        run,
        failing(run, "testing", "El build de la vista previa ha fallado"),
      );

    case "report_ready":
      return s === "awaiting_preview" ? result(run, "testing") : null;

    case "testing_done": {
      if (s !== "testing") return null;
      const passed: TaskChange[] = event.verdicts
        .filter((v) => v.passed)
        .map((v) => ({ id: v.taskId, status: "passed", lastFeedback: null }));
      const failed = event.verdicts.filter((v) => !v.passed);
      if (failed.length === 0) {
        const pending = run.tasks.some(
          (t) =>
            t.status !== "passed" &&
            !event.verdicts.some((v) => v.taskId === t.id),
        );
        // Every task of the plan must have passed before the final approval.
        if (pending) return null;
        return result(run, "awaiting_final_approval", { tasks: passed });
      }
      const next = afterFailures(run, failed);
      return { ...next, tasks: [...passed, ...next.tasks] };
    }

    case "approve_final":
      return s === "awaiting_final_approval" ? result(run, "merging") : null;

    case "merged":
      return result(run, "done");

    case "pr_closed":
      // Closed on GitHub without merging: the branch still has to go.
      return result(run, "cancelled");

    case "retry": {
      if (s !== "blocked") return null;
      const stuck = run.tasks.filter(
        (t) => t.status === "blocked" || t.status === "failed",
      );
      if (stuck.length > 0) {
        return result(run, "developing", {
          tasks: stuck.map((t) => ({
            id: t.id,
            status: "developing",
            iteration: t.iteration + 1,
            maxIterations: Math.max(t.maxIterations, t.iteration + 1),
          })),
        });
      }
      return result(run, run.blockedFrom ?? "planning");
    }

    case "cancel":
      return result(run, "cancelled");

    case "preview_timeout":
      return s === "awaiting_preview"
        ? blocked(run, "La vista previa no ha llegado en 15 minutos")
        : null;

    case "approval_timeout":
      return AWAITING_HUMAN.includes(s) ? result(run, "cancelled") : null;

    case "block":
      // awaiting_check too: a migration commit that does not check out (D31).
      return isStep(s) || s === "awaiting_check"
        ? blocked(run, event.reason)
        : null;

    case "step_failed":
      return isStep(s) ? result(run, "failed") : null;
  }
}
