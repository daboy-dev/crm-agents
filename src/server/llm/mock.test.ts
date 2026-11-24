import { describe, expect, it } from "vitest";
import { runDevelop, runOrchestrator, runTesting } from "@/server/agents";
import type {
  E2eSummary,
  PlanInput,
  TaskBrief,
} from "@/server/agents/contracts";
import { checkPaths } from "@/server/agents/paths";
import { MockProvider, type MockScenario } from "./mock";

const passed: E2eSummary = {
  status: "passed",
  passed: 24,
  failed: 0,
  failures: [],
};
const failed: E2eSummary = {
  status: "failed",
  passed: 22,
  failed: 2,
  failures: [],
};

const planInput = (over: Partial<PlanInput> = {}): PlanInput => ({
  runId: 7,
  request: "Añadir el NIF",
  planRevision: 1,
  mode: "replace",
  feedback: null,
  previous: null,
  context: { baseSha: "abc", tree: [], files: [] },
  ...over,
});

async function brief(n: number): Promise<TaskBrief> {
  const plan = await runOrchestrator(new MockProvider("ok"), planInput());
  const t = plan.tasks[n - 1]!;
  return { position: n, ...t };
}

async function verdict(
  scenario: MockScenario,
  n: number,
  iteration: number,
  report = passed,
) {
  return runTesting(new MockProvider(scenario), {
    runId: 7,
    task: await brief(n),
    iteration,
    report,
  });
}

describe("MockProvider", () => {
  it("plans two tasks and carries the feedback", async () => {
    const plan = await runOrchestrator(
      new MockProvider("ok"),
      planInput({ planRevision: 2, feedback: "Hazlo obligatorio" }),
    );
    expect(plan.tasks).toHaveLength(2);
    expect(plan.summary).toContain("revisión 2");
    expect(plan.summary).toContain("Hazlo obligatorio");
  });

  it("an amend replan adds a single corrective task (D29)", async () => {
    const plan = await runOrchestrator(
      new MockProvider("ok"),
      planInput({ planRevision: 2, mode: "amend", feedback: "Más grande" }),
    );
    expect(plan.tasks.map((t) => t.title)).toEqual(["Tarea correctiva 1"]);
  });

  it("develops one file per task under agent-runs", async () => {
    const out = await runDevelop(new MockProvider("ok"), {
      runId: 7,
      request: "r",
      task: await brief(1),
      iteration: 1,
      feedback: null,
    });
    expect(out.files.map((f) => f.path)).toEqual(["agent-runs/7/task-1.md"]);
    expect(checkPaths(out.files.map((f) => f.path)).ok).toBe(true);
  });

  it("forbidden writes a workflow in task 2, which the guard rejects", async () => {
    const out = await runDevelop(new MockProvider("forbidden"), {
      runId: 7,
      request: "r",
      task: await brief(2),
      iteration: 1,
      feedback: null,
    });
    expect(checkPaths(out.files.map((f) => f.path)).ok).toBe(false);
  });

  it.each([
    ["ok", 2, 1, true],
    ["fail-once", 1, 1, true],
    ["fail-once", 2, 1, false],
    ["fail-once", 2, 2, true],
    ["blocked", 1, 1, true],
    ["blocked", 2, 3, false],
  ] as const)(
    "%s: task %i iteration %i passes=%s",
    async (scenario, n, it, expected) => {
      expect((await verdict(scenario, n, it)).passed).toBe(expected);
    },
  );

  it("a failing real E2E fails every task, whatever the scenario", async () => {
    const v = await verdict("ok", 1, 1, failed);
    expect(v.passed).toBe(false);
    expect(v.summary).toContain("E2E real");
  });
});
