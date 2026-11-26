import { describe, expect, it } from "vitest";
import type { Criterion, CriterionResult } from "@/server/agents/contracts";
import { taskSection, type TaskViewInput } from "./task-view";

const criterion = (id: string, type: "e2e" | "visual" = "e2e"): Criterion => ({
  id,
  type,
  text: `Criterio ${id}`,
  testIds: ["client-type"],
});

const task = (
  id: number,
  over: Partial<TaskViewInput["tasks"][number]> = {},
): TaskViewInput["tasks"][number] => ({
  id,
  position: id,
  title: `Tarea ${id}`,
  description: "",
  status: "testing",
  iteration: 1,
  maxIterations: 3,
  commitSha: null,
  files: ["src/app/clientes/page.tsx"],
  acceptanceCriteria: [criterion(`c${id}`)],
  lastFeedback: null,
  splitFrom: null,
  ...over,
});

const result = (
  key: string,
  project: string,
  passed: boolean,
  run = 30,
): CriterionResult => ({
  key,
  run,
  revision: Number(key.slice(1).split("-")[0]),
  criterion: key.split("-")[1]!,
  project,
  passed,
  error: passed ? null : "Timeout",
  failedStep: passed
    ? null
    : {
        step: 3,
        action: 'expectText client-type-badge "Empresa"',
        url: "/clientes",
      },
  snapshot: null,
});

const input = (over: Partial<TaskViewInput> = {}): TaskViewInput => ({
  runId: 30,
  planRevision: 1,
  tasks: [task(1), task(2)],
  titles: new Map(),
  events: [],
  steps: null,
  report: null,
  ...over,
});

describe("taskSection (D43)", () => {
  it("without a report every e2e criterion is pending", () => {
    const s = taskSection(input());
    expect(s.hasReport).toBe(false);
    const c =
      s.groups[0]!.kind === "task" ? s.groups[0]!.task.criteria[0]! : null;
    expect(c?.outcome).toBe("pending");
    expect(c?.results.map((r) => r.outcome)).toEqual(["pending", "pending"]);
  });

  it("a criterion passes when both sizes passed", () => {
    const s = taskSection(
      input({
        report: {
          criteria: [
            result("r1-c1", "desktop", true),
            result("r1-c1", "mobile-390", true),
            result("r1-c2", "desktop", true),
            result("r1-c2", "mobile-390", false),
          ],
          failures: [],
        },
        events: [
          {
            kind: "explain",
            data: {
              criteria: [
                {
                  key: "r1-c2",
                  task: 2,
                  verdict: "fail",
                  reason: "Falta la insignia de tipo en la fila",
                  evidence: 'expectText client-type-badge "Empresa"',
                },
              ],
              regressions: [],
            },
          },
        ],
      }),
    );
    const [one, two] = s.groups.map((g) => (g.kind === "task" ? g.task : null));
    expect(one!.criteria[0]!.outcome).toBe("pass");
    const failing = two!.criteria[0]!;
    expect(failing.outcome).toBe("fail");
    expect(failing.results.map((r) => `${r.label} ${r.outcome}`)).toEqual([
      "1280 px pass",
      "390 px fail",
    ]);
    expect(failing.reason).toBe("Falta la insignia de tipo en la fila");
    expect(failing.failedStep).toBe('expectText client-type-badge "Empresa"');
  });

  it("without Testing's explanation the failed step comes from the runner", () => {
    const s = taskSection(
      input({
        tasks: [task(1)],
        report: {
          criteria: [result("r1-c1", "desktop", false)],
          failures: [],
        },
      }),
    );
    const c =
      s.groups[0]!.kind === "task" ? s.groups[0]!.task.criteria[0]! : null;
    expect(c?.reason).toBeNull();
    expect(c?.failedStep).toContain("(en /clientes)");
  });

  it("an old reason is hidden once the criterion passes", () => {
    const s = taskSection(
      input({
        tasks: [task(1)],
        report: {
          criteria: [
            result("r1-c1", "desktop", true),
            result("r1-c1", "mobile-390", true),
          ],
          failures: [],
        },
        events: [
          {
            kind: "explain",
            data: { criteria: [{ key: "r1-c1", reason: "x", evidence: "y" }] },
          },
        ],
      }),
    );
    const c =
      s.groups[0]!.kind === "task" ? s.groups[0]!.task.criteria[0]! : null;
    expect(c?.reason).toBeNull();
    expect(c?.failedStep).toBeNull();
  });

  it("uses the keys of the current revision (D29)", () => {
    const s = taskSection(
      input({
        planRevision: 2,
        tasks: [task(1)],
        report: {
          criteria: [
            result("r1-c1", "desktop", false),
            result("r2-c1", "desktop", true),
            result("r2-c1", "mobile-390", true),
          ],
          failures: [],
        },
      }),
    );
    const c =
      s.groups[0]!.kind === "task" ? s.groups[0]!.task.criteria[0]! : null;
    expect(c?.key).toBe("r2-c1");
    expect(c?.outcome).toBe("pass");
  });

  it("a visual criterion is not checked automatically", () => {
    const s = taskSection(
      input({
        tasks: [task(1, { acceptanceCriteria: [criterion("c1", "visual")] })],
      }),
    );
    const c =
      s.groups[0]!.kind === "task" ? s.groups[0]!.task.criteria[0]! : null;
    expect(c?.outcome).toBe("manual");
    expect(c?.results).toEqual([]);
  });

  it("files of the last commit, with the ones outside the plan marked (D34)", () => {
    const s = taskSection(
      input({
        tasks: [task(1)],
        events: [
          {
            kind: "commit",
            data: { taskId: 1, files: ["a.ts"], outsidePlan: [] },
          },
          {
            kind: "commit",
            data: {
              taskId: 1,
              files: ["src/app/clientes/page.tsx", "src/lib/x.ts"],
              outsidePlan: ["src/lib/x.ts"],
            },
          },
        ],
      }),
    );
    const t = s.groups[0]!.kind === "task" ? s.groups[0]!.task : null;
    expect(t?.touched).toEqual([
      { path: "src/app/clientes/page.tsx", outside: false },
      { path: "src/lib/x.ts", outside: true },
    ]);
  });

  it("attaches the steps of each criterion (D38)", () => {
    const steps = [{ action: "goto" as const, path: "/clientes" }];
    const s = taskSection(
      input({ tasks: [task(1)], steps: { criteria: [{ id: "c1", steps }] } }),
    );
    const t = s.groups[0]!.kind === "task" ? s.groups[0]!.task : null;
    expect(t?.criteria[0]!.steps).toEqual(steps);
  });

  it("groups subtasks under the task they come from (D34)", () => {
    const s = taskSection(
      input({
        planRevision: 2,
        tasks: [
          task(5, { position: 1 }),
          task(6, { position: 2, splitFrom: 2 }),
          task(7, { position: 3, splitFrom: 2 }),
        ],
        titles: new Map([[2, "Tipo de cliente en el formulario"]]),
      }),
    );
    expect(s.groups.map((g) => g.kind)).toEqual(["task", "split"]);
    const split = s.groups[1]!;
    expect(split.kind === "split" && split.title).toBe(
      "Tipo de cliente en el formulario",
    );
    expect(split.kind === "split" && split.tasks.map((t) => t.id)).toEqual([
      6, 7,
    ]);
  });

  it("criteria of earlier runs and other E2E tests go to regression (D38)", () => {
    const s = taskSection(
      input({
        report: {
          criteria: [
            result("r1-c1", "desktop", true),
            result("r1-c1", "desktop", true, 24),
            result("r1-c1", "mobile-390", true, 24),
            result("r1-c2", "desktop", true, 22),
            result("r1-c2", "mobile-390", false, 22),
          ],
          failures: [
            {
              title: "criteria.spec.ts › criteria › run-22 r1 c2 · X",
              project: "mobile-390",
              error: "e",
            },
            { title: "smoke.spec.ts › lists", project: "desktop", error: "z" },
          ],
        },
      }),
    );
    expect(s.regression.total).toBe(3);
    expect(s.regression.passed).toBe(1);
    expect(s.regression.items.map((i) => `${i.title} ${i.outcome}`)).toEqual([
      "Run #22 · r1-c2 fail",
      "smoke.spec.ts › lists fail",
      "Run #24 · r1-c1 pass",
    ]);
  });
});
