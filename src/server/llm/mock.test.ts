import { describe, expect, it } from "vitest";
import {
  runDevelop,
  runOrchestrator,
  runTestingExplain,
  runTestingSteps,
} from "@/server/agents";
import type { PlanInput, TaskBrief } from "@/server/agents/contracts";
import { checkPaths } from "@/server/agents/paths";
import { MockProvider } from "./mock";

const planInput = (over: Partial<PlanInput> = {}): PlanInput => ({
  runId: 7,
  request: "Añadir el NIF",
  planRevision: 1,
  mode: "replace",
  feedback: null,
  previous: null,
  context: { baseSha: "abc", tree: ["AGENTS.md"], files: [] },
  ...over,
});

const emptyContext = {
  sha: "abc",
  tree: [],
  files: [],
  newFiles: [],
  trimmed: [],
};

async function brief(n: number): Promise<TaskBrief> {
  const { output: plan } = await runOrchestrator(
    new MockProvider("ok"),
    planInput(),
  );
  const t = plan.tasks[n - 1]!;
  return { position: n, ...t };
}

describe("MockProvider", () => {
  it("plans two tasks and carries the feedback", async () => {
    const { output: plan } = await runOrchestrator(
      new MockProvider("ok"),
      planInput({ planRevision: 2, feedback: "Hazlo obligatorio" }),
    );
    expect(plan.tasks).toHaveLength(2);
    expect(plan.summary).toContain("revisión 2");
    expect(plan.summary).toContain("Hazlo obligatorio");
  });

  it("an amend replan adds a single corrective task (D29)", async () => {
    const { output: plan } = await runOrchestrator(
      new MockProvider("ok"),
      planInput({ planRevision: 2, mode: "amend", feedback: "Más grande" }),
    );
    expect(plan.tasks.map((t) => t.title)).toEqual(["Tarea correctiva 1"]);
  });

  it("develops one file per task under agent-runs", async () => {
    const { output: out } = await runDevelop(new MockProvider("ok"), {
      runId: 7,
      request: "r",
      task: await brief(1),
      iteration: 1,
      feedback: null,
      context: emptyContext,
    });
    expect(out.files.map((f) => f.path)).toEqual(["agent-runs/7/task-1.md"]);
    expect(checkPaths(out.files.map((f) => f.path)).ok).toBe(true);
  });

  it("forbidden writes a workflow in task 2, which the guard rejects", async () => {
    const { output: out } = await runDevelop(new MockProvider("forbidden"), {
      runId: 7,
      request: "r",
      task: await brief(2),
      iteration: 1,
      feedback: null,
      context: emptyContext,
    });
    expect(checkPaths(out.files.map((f) => f.path)).ok).toBe(false);
  });

  it("writes passing steps over elements that already exist (D38)", async () => {
    const tasks = [await brief(1), await brief(2)];
    const { output } = await runTestingSteps(new MockProvider("ok"), {
      runId: 7,
      request: "r",
      planRevision: 1,
      tasks,
      criteria: tasks.flatMap((t) =>
        t.acceptanceCriteria.map((c) => ({
          id: c.id,
          task: t.position,
          text: c.text,
          testIds: c.testIds,
        })),
      ),
      pages: ["clientes", "facturas"],
      examples: [],
    });
    expect(output.criteria.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(output.criteria[1]!.steps).toEqual([
      { action: "goto", path: "/facturas" },
      { action: "expectVisible", testId: "invoices-table" },
    ]);
  });

  it("explains every failure and assigns the regressions (D39)", async () => {
    const { output } = await runTestingExplain(new MockProvider("ok"), {
      runId: 7,
      request: "r",
      tasks: [{ position: 2, title: "t", files: ["a.ts"] }],
      failed: [
        {
          key: "r1-c3",
          run: 7,
          revision: 1,
          criterion: "c3",
          project: "desktop",
          passed: false,
          error: "no está",
          failedStep: { step: 2, action: "click x", url: "/clientes" },
          snapshot: null,
          task: 2,
          text: "x",
        },
      ],
      regressions: [{ title: "smoke › lists", project: "desktop", error: "e" }],
    });
    expect(output.criteria).toMatchObject([
      { key: "r1-c3", verdict: "fail", evidence: "click x" },
    ]);
    expect(output.regressions).toMatchObject([
      { test: "smoke › lists", task: 2 },
    ]);
  });
});
