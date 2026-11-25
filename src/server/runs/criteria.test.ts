import { describe, expect, it } from "vitest";
import type { CriterionResult } from "@/server/agents/contracts";
import {
  buildCriteriaFile,
  feedbackFor,
  isSplitRevision,
  judge,
  liveRevisions,
  pageNames,
  type CurrentCriterion,
} from "./criteria";

const crit = (id: string, testIds = ["invoices-table"]) => ({
  id,
  type: "e2e" as const,
  text: `Criterio ${id}`,
  testIds,
});
const task = (
  id: number,
  planRevision: number,
  position: number,
  criteria: string[],
  splitFrom: number | null = null,
) => ({
  id,
  planRevision,
  position,
  acceptanceCriteria: criteria.map((c) => crit(c)),
  splitFrom,
});
const steps = (...ids: string[]) => ({
  criteria: ids.map((id) => ({
    id,
    steps: [
      { action: "goto" as const, path: "/facturas" },
      { action: "expectVisible" as const, testId: "invoices-table" },
    ],
  })),
});

// Revision 1: two tasks. Revision 2: task 2 split in two (D34).
// Revision 3: an amend with one new task (D29), its ids from c1 again.
const tasks = [
  task(1, 1, 1, ["c1"]),
  task(2, 1, 2, ["c2", "c3"]),
  task(3, 2, 1, ["c1"]),
  task(4, 2, 2, ["c2"], 2),
  task(5, 2, 3, ["c3"], 2),
  task(6, 3, 1, ["c1"]),
];

describe("revisions of the criteria (D38)", () => {
  it("a split replaces its revision; an amend keeps the previous one", () => {
    expect(isSplitRevision(tasks, 2)).toBe(true);
    expect(isSplitRevision(tasks, 3)).toBe(false);
    expect(liveRevisions(tasks, [1, 2, 3])).toEqual([2, 3]);
  });

  it("builds the JSON of the live revisions, stable across retries", () => {
    const stored = new Map([
      [1, steps("c1", "c2", "c3")],
      [2, steps("c1", "c2", "c3")],
      [3, steps("c1")],
    ]);
    const file = buildCriteriaFile(7, tasks, stored);
    expect(file).toBe(buildCriteriaFile(7, tasks, stored));
    const json = JSON.parse(file) as {
      run: number;
      criteria: { id: string; revision: number; task: number }[];
    };
    expect(json.run).toBe(7);
    expect(
      json.criteria.map((c) => `r${c.revision} ${c.id} t${c.task}`),
    ).toEqual(["r2 c1 t1", "r2 c2 t2", "r2 c3 t3", "r3 c1 t1"]);
  });

  it("reads the page names of e2e/pages.ts", () => {
    expect(
      pageNames(
        `[{ name: "clientes", path: "/clientes" },\n  { name: "cliente-detalle", fromList: "/clientes" }]`,
      ),
    ).toEqual(["clientes", "cliente-detalle"]);
    expect(pageNames(null)).toEqual([]);
  });
});

const result = (
  key: string,
  project: string,
  passed: boolean,
  run = 7,
): CriterionResult => ({
  key,
  run,
  revision: Number(key.slice(1, key.indexOf("-"))),
  criterion: key.split("-")[1]!,
  project,
  passed,
  error: passed ? null : "Paso 2 (click x): Timeout",
  failedStep: passed ? null : { step: 2, action: "click x", url: "/facturas" },
  snapshot: passed ? null : '- main:\n  - heading "Facturas"',
});
const current: CurrentCriterion[] = [
  { key: "r1-c1", taskId: 10, task: 1, text: "Filtra" },
  { key: "r1-c2", taskId: 11, task: 2, text: "Notas" },
];

describe("verdict of the runner (D39)", () => {
  it("a criterion passes only when every project passed", () => {
    const j = judge(
      7,
      current,
      [
        result("r1-c1", "desktop", true),
        result("r1-c1", "mobile-390", true),
        result("r1-c2", "desktop", true),
        result("r1-c2", "mobile-390", false),
      ],
      [],
    );
    expect(j.passed).toEqual(["r1-c1"]);
    expect(j.failed.map((f) => `${f.key} ${f.project} ${f.taskId}`)).toEqual([
      "r1-c2 mobile-390 11",
    ]);
  });

  it("a criterion without result fails: its test did not run", () => {
    const j = judge(7, current, [result("r1-c1", "desktop", true)], []);
    expect(j.failed.map((f) => f.key)).toEqual(["r1-c2"]);
    expect(j.failed[0]!.error).toContain("no ha corrido");
  });

  it("other failing tests are regressions, older runs' criteria included", () => {
    const j = judge(
      7,
      current,
      [
        result("r1-c1", "desktop", true),
        result("r1-c2", "desktop", false),
        result("r1-c1", "desktop", false, 5),
      ],
      [
        {
          title: "criteria.spec.ts › criteria › run-7 r1 c2 · Notas",
          project: "desktop",
          error: "x",
        },
        {
          title: "criteria.spec.ts › criteria › run-5 r1 c1 · Filtro",
          project: "desktop",
          error: "y",
        },
        { title: "smoke.spec.ts › lists", project: "desktop", error: "z" },
        { title: "smoke.spec.ts › lists", project: "mobile-390", error: "z" },
      ],
    );
    expect(j.regressions.map((r) => r.title)).toEqual([
      "criteria.spec.ts › criteria › run-5 r1 c1 · Filtro",
      "smoke.spec.ts › lists",
    ]);
  });
});

describe("feedback for Develop (D39)", () => {
  it("has the reason, the failed step and the snapshot, never the steps", () => {
    const text = feedbackFor(
      [
        {
          key: "r1-c2",
          criterion: "c2",
          reason: "El detalle no muestra las notas",
          evidence: "expectText client-notes",
          snapshot: '- main:\n  - heading "Cliente"',
          url: "/clientes/3",
        },
      ],
      [{ test: "smoke.spec.ts › lists", reason: "La lista ya no carga" }],
    );
    expect(text).toContain("c2: El detalle no muestra las notas");
    expect(text).toContain("Paso que falla: expectText client-notes");
    expect(text).toContain('heading "Cliente"');
    expect(text).toContain("smoke.spec.ts › lists: La lista ya no carga");
    expect(text).not.toContain("goto");
  });
});
