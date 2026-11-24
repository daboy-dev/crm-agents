import { describe, expect, it } from "vitest";
import {
  RUN_STATUSES,
  transition,
  type RunEvent,
  type RunState,
  type RunStatus,
  type TaskState,
} from "./machine";

const task = (id: number, over: Partial<TaskState> = {}): TaskState => ({
  id,
  status: "pending",
  iteration: 0,
  maxIterations: 3,
  ...over,
});

const run = (status: RunStatus, over: Partial<RunState> = {}): RunState => ({
  status,
  tasks: [task(1), task(2)],
  blockedFrom: null,
  hasBranch: false,
  ...over,
});

type Row = {
  name: string;
  from: RunState;
  event: RunEvent;
  to: RunStatus | null;
  effects?: string[];
};

const testing = (iteration = 1) => [
  task(1, { status: "testing", iteration }),
  task(2, { status: "testing", iteration }),
];

const table: Row[] = [
  // Happy path
  {
    name: "start",
    from: run("queued"),
    event: { type: "start" },
    to: "planning",
    effects: ["run_step"],
  },
  {
    name: "plan ready",
    from: run("planning"),
    event: { type: "plan_ready" },
    to: "awaiting_plan_approval",
    effects: [],
  },
  {
    name: "approve plan",
    from: run("awaiting_plan_approval"),
    event: { type: "approve_plan" },
    to: "developing",
    effects: ["run_step"],
  },
  {
    name: "develop done",
    from: run("developing"),
    event: { type: "develop_done" },
    to: "awaiting_preview",
    effects: ["check_preview"],
  },
  {
    name: "report ready",
    from: run("awaiting_preview"),
    event: { type: "report_ready" },
    to: "testing",
    effects: ["run_step"],
  },
  {
    name: "all tasks pass",
    from: run("testing", { tasks: testing() }),
    event: {
      type: "testing_done",
      verdicts: [
        { taskId: 1, passed: true, feedback: "" },
        { taskId: 2, passed: true, feedback: "" },
      ],
    },
    to: "awaiting_final_approval",
    effects: [],
  },
  {
    name: "approve final",
    from: run("awaiting_final_approval"),
    event: { type: "approve_final" },
    to: "merging",
    effects: ["run_step"],
  },
  {
    name: "merged",
    from: run("merging", { hasBranch: true }),
    event: { type: "merged" },
    to: "done",
    effects: ["start_next"],
  },

  // Feedback and rejection (D9)
  {
    name: "plan feedback replans",
    from: run("awaiting_plan_approval"),
    event: { type: "reject", feedback: "Añade el NIF" },
    to: "planning",
    effects: ["run_step"],
  },
  {
    name: "final feedback replans",
    from: run("awaiting_final_approval", { hasBranch: true }),
    event: { type: "reject", feedback: "Más grande" },
    to: "planning",
    effects: ["run_step"],
  },
  {
    name: "reject without feedback",
    from: run("awaiting_plan_approval"),
    event: { type: "reject", feedback: "  " },
    to: "rejected",
    effects: ["start_next"],
  },
  {
    name: "reject final cleans up",
    from: run("awaiting_final_approval", { hasBranch: true }),
    event: { type: "reject", feedback: null },
    to: "rejected",
    effects: ["cleanup", "start_next"],
  },

  // Failures and iterations (D5, D20)
  {
    name: "a failed task goes back to develop",
    from: run("testing", { tasks: testing() }),
    event: {
      type: "testing_done",
      verdicts: [
        { taskId: 1, passed: true, feedback: "" },
        { taskId: 2, passed: false, feedback: "no" },
      ],
    },
    to: "developing",
    effects: ["run_step"],
  },
  {
    name: "third failure blocks",
    from: run("testing", { tasks: testing(3) }),
    event: {
      type: "testing_done",
      verdicts: [
        { taskId: 1, passed: true, feedback: "" },
        { taskId: 2, passed: false, feedback: "no" },
      ],
    },
    to: "blocked",
    effects: [],
  },
  {
    name: "broken build goes back to develop",
    from: run("awaiting_preview", { tasks: testing() }),
    event: { type: "build_failed" },
    to: "developing",
    effects: ["run_step"],
  },
  {
    name: "forbidden path blocks",
    from: run("developing"),
    event: { type: "forbidden", taskId: 2, reason: ".github" },
    to: "blocked",
    effects: [],
  },
  {
    name: "preview timeout blocks",
    from: run("awaiting_preview"),
    event: { type: "preview_timeout" },
    to: "blocked",
    effects: [],
  },
  {
    name: "limit blocks a step",
    from: run("planning"),
    event: { type: "block", reason: "llm" },
    to: "blocked",
    effects: [],
  },
  {
    name: "step failure fails the run",
    from: run("developing", { hasBranch: true }),
    event: { type: "step_failed", reason: "x" },
    to: "failed",
    effects: ["cleanup", "start_next"],
  },

  // Human and GitHub exits
  {
    name: "cancel while waiting",
    from: run("awaiting_plan_approval"),
    event: { type: "cancel" },
    to: "cancelled",
    effects: ["start_next"],
  },
  {
    name: "abandon a blocked run",
    from: run("blocked", { hasBranch: true }),
    event: { type: "cancel" },
    to: "cancelled",
    effects: ["cleanup", "start_next"],
  },
  {
    name: "approval timeout cancels",
    from: run("awaiting_final_approval", { hasBranch: true }),
    event: { type: "approval_timeout" },
    to: "cancelled",
    effects: ["cleanup", "start_next"],
  },
  {
    name: "PR closed on GitHub",
    from: run("awaiting_preview", { hasBranch: true }),
    event: { type: "pr_closed" },
    to: "cancelled",
    effects: ["cleanup", "start_next"],
  },
  {
    name: "merged on GitHub",
    from: run("awaiting_final_approval"),
    event: { type: "merged" },
    to: "done",
    effects: ["start_next"],
  },
  {
    name: "retry blocked tasks",
    from: run("blocked", {
      blockedFrom: "testing",
      tasks: [
        task(1, { status: "passed" }),
        task(2, { status: "blocked", iteration: 3 }),
      ],
    }),
    event: { type: "retry" },
    to: "developing",
    effects: ["run_step"],
  },
  {
    name: "retry a timeout resumes",
    from: run("blocked", { blockedFrom: "awaiting_preview", tasks: testing() }),
    event: { type: "retry" },
    to: "awaiting_preview",
    effects: ["check_preview"],
  },

  // Events that do not apply are no-ops (double click, redelivery)
  {
    name: "double approve",
    from: run("developing"),
    event: { type: "approve_plan" },
    to: null,
  },
  {
    name: "late report",
    from: run("testing"),
    event: { type: "report_ready" },
    to: null,
  },
  {
    name: "start twice",
    from: run("planning"),
    event: { type: "start" },
    to: null,
  },
  {
    name: "approve without tasks",
    from: run("awaiting_plan_approval", { tasks: [] }),
    event: { type: "approve_plan" },
    to: null,
  },
  {
    name: "retry when not blocked",
    from: run("developing"),
    event: { type: "retry" },
    to: null,
  },
  {
    name: "build failure after testing",
    from: run("testing"),
    event: { type: "build_failed" },
    to: null,
  },
];

describe("transition", () => {
  it.each(table)("$name", ({ from, event, to, effects }) => {
    const next = transition(from, event);
    if (to === null) {
      expect(next).toBeNull();
      return;
    }
    expect(next?.status).toBe(to);
    if (effects) expect(next?.effects.map((e) => e.type)).toEqual(effects);
  });

  it("final statuses accept nothing", () => {
    for (const status of ["done", "rejected", "cancelled", "failed"] as const) {
      expect(transition(run(status), { type: "cancel" })).toBeNull();
      expect(transition(run(status), { type: "merged" })).toBeNull();
    }
  });

  it("every status is covered by the table", () => {
    const covered = new Set(table.map((r) => r.from.status));
    for (const s of RUN_STATUSES) {
      if (["done", "rejected", "cancelled", "failed"].includes(s)) continue;
      expect(covered, s).toContain(s);
    }
  });

  it("approving the plan starts iteration 1 of every task", () => {
    const next = transition(run("awaiting_plan_approval"), {
      type: "approve_plan",
    });
    expect(next?.tasks).toEqual([
      { id: 1, status: "developing", iteration: 1 },
      { id: 2, status: "developing", iteration: 1 },
    ]);
  });

  it("only the failed task gets another iteration", () => {
    const next = transition(run("testing", { tasks: testing() }), {
      type: "testing_done",
      verdicts: [
        { taskId: 1, passed: true, feedback: "" },
        { taskId: 2, passed: false, feedback: "Falta el campo" },
      ],
    });
    expect(next?.tasks).toEqual([
      { id: 1, status: "passed", lastFeedback: null },
      {
        id: 2,
        status: "developing",
        iteration: 2,
        lastFeedback: "Falta el campo",
      },
    ]);
  });

  it("blocking keeps the other failed tasks as failed", () => {
    const next = transition(
      run("testing", {
        tasks: [
          task(1, { status: "testing", iteration: 1 }),
          task(2, { status: "testing", iteration: 3 }),
        ],
      }),
      {
        type: "testing_done",
        verdicts: [
          { taskId: 1, passed: false, feedback: "a" },
          { taskId: 2, passed: false, feedback: "b" },
        ],
      },
    );
    expect(next?.status).toBe("blocked");
    expect(next?.blockedFrom).toBe("testing");
    expect(next?.tasks.map((t) => t.status)).toEqual(["failed", "blocked"]);
  });

  it("retry gives a blocked task one more iteration", () => {
    const next = transition(
      run("blocked", { tasks: [task(2, { status: "blocked", iteration: 3 })] }),
      { type: "retry" },
    );
    expect(next?.tasks).toEqual([
      { id: 2, status: "developing", iteration: 4, maxIterations: 4 },
    ]);
  });

  it("feedback is carried to the new plan", () => {
    const next = transition(run("awaiting_plan_approval"), {
      type: "reject",
      feedback: " Añade el NIF ",
    });
    expect(next?.replan).toEqual({ feedback: "Añade el NIF" });
  });

  it("only tasks under development move to testing", () => {
    const next = transition(
      run("developing", {
        tasks: [
          task(1, { status: "passed" }),
          task(2, { status: "developing" }),
        ],
      }),
      { type: "develop_done" },
    );
    expect(next?.tasks).toEqual([{ id: 2, status: "testing" }]);
  });

  it("a verdict set that leaves a task untested is rejected", () => {
    const next = transition(run("testing", { tasks: testing() }), {
      type: "testing_done",
      verdicts: [{ taskId: 1, passed: true, feedback: "" }],
    });
    expect(next).toBeNull();
  });
});
