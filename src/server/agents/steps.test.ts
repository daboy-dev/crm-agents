import { describe, expect, it } from "vitest";
import {
  explainSchemaFor,
  stepsSchemaFor,
  type CriteriaSteps,
  type ExplainInput,
} from "./contracts";

const scope = {
  criteria: [
    { id: "c1", testIds: ["invoice-status-filter", "invoice-row"] },
    {
      id: "c2",
      testIds: [
        "new-client-button",
        "field-notes",
        "save-button",
        "client-notes",
      ],
    },
  ],
  pages: ["clientes", "facturas", "cliente-detalle"],
};

const valid: CriteriaSteps = {
  criteria: [
    {
      id: "c1",
      steps: [
        { action: "goto", page: "facturas" },
        { action: "select", testId: "invoice-status-filter", value: "paid" },
        { action: "expectCount", testId: "invoice-row", min: 0 },
      ],
    },
    {
      id: "c2",
      steps: [
        { action: "goto", path: "/clientes/nuevo" },
        { action: "fill", testId: "field-notes", value: "Nota {{stamp}}" },
        { action: "click", testId: "save-button" },
        {
          action: "expectText",
          testId: "client-notes",
          text: "Nota {{stamp}}",
        },
      ],
    },
  ],
};

const messages = (value: unknown) => {
  const r = stepsSchemaFor(scope).safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

const withStep = (step: unknown, id = "c1") => ({
  criteria: valid.criteria.map((c) =>
    c.id === id ? { ...c, steps: [c.steps[0], step, c.steps.at(-1)] } : c,
  ),
});

describe("steps of the criteria runner (D38)", () => {
  it("accepts steps by data-testid over pages and relative paths", () => {
    expect(messages(valid)).toEqual([]);
  });

  it.each([
    ["CSS selector", { action: "click", testId: "#save" }],
    ["class selector", { action: "click", testId: ".btn-primary" }],
    ["selector field", { action: "click", selector: "button.save" }],
    ["JavaScript", { action: "evaluate", script: "document.cookie" }],
    ["absolute URL", { action: "goto", path: "https://evil.example.com" }],
    ["protocol-relative URL", { action: "goto", path: "//evil.example.com/x" }],
    ["scheme", { action: "goto", path: "javascript:alert(1)" }],
  ])("rejects a %s", (_, step) => {
    expect(messages(withStep(step)).length).toBeGreaterThan(0);
  });

  it("only takes the data-testid of its own criterion", () => {
    expect(
      messages(withStep({ action: "click", testId: "save-button" })),
    ).toEqual([
      "save-button no está entre los data-testid del criterio c1: usa solo invoice-status-filter, invoice-row",
    ]);
  });

  it("needs every criterion once, a goto first and some expect", () => {
    expect(messages({ criteria: [valid.criteria[0]] })).toEqual([
      "Faltan los pasos de c2",
    ]);
    expect(
      messages({
        criteria: [
          valid.criteria[0],
          { id: "c2", steps: [{ action: "click", testId: "save-button" }] },
        ],
      }),
    ).toEqual([
      "El primer paso es siempre un goto",
      "c2 no comprueba nada: añade algún expect",
    ]);
    expect(
      messages({
        criteria: [...valid.criteria, { ...valid.criteria[0]!, id: "c9" }],
      }),
    ).toEqual(["c9 no es un criterio de esta revisión"]);
  });

  it("goto takes a page of pages.ts or a path, and expectCount count or min", () => {
    expect(
      messages(withStep({ action: "goto", page: "resumen" }))[0],
    ).toContain("La página resumen no está en e2e/pages.ts");
    expect(
      messages(
        withStep({ action: "goto", page: "facturas", path: "/facturas" }),
      ),
    ).toEqual(["goto lleva page o path, uno de los dos"]);
    expect(
      messages(withStep({ action: "expectCount", testId: "invoice-row" })),
    ).toEqual(["expectCount lleva count o min, uno de los dos"]);
  });
});

const explainInput: ExplainInput = {
  runId: 7,
  request: "Filtro de facturas",
  tasks: [
    {
      position: 1,
      title: "Filtro",
      files: ["src/app/(crm)/facturas/page.tsx"],
    },
  ],
  failed: [
    {
      key: "r1-c1",
      run: 7,
      revision: 1,
      criterion: "c1",
      project: "desktop",
      passed: false,
      error: "Timeout",
      failedStep: {
        step: 2,
        action: "select invoice-status-filter",
        url: "/facturas",
      },
      snapshot: '- main:\n  - heading "Facturas"',
      task: 1,
      text: "El filtro deja solo las pagadas",
    },
  ],
  regressions: [
    { title: "smoke.spec.ts › lists", project: "desktop", error: "x" },
  ],
};

describe("Testing's explanation (D39)", () => {
  const schema = explainSchemaFor(explainInput);
  const ok = {
    criteria: [
      {
        key: "r1-c1",
        task: 1,
        verdict: "fail",
        reason: "No hay filtro en /facturas",
        evidence: "select invoice-status-filter",
      },
    ],
    regressions: [
      { test: "smoke.spec.ts › lists", task: 1, reason: "Rompe la lista" },
    ],
  };
  const issues = (v: unknown) => {
    const r = schema.safeParse(v);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it("explains each failure and assigns each regression to a task", () => {
    expect(issues(ok)).toEqual([]);
  });

  it("cannot turn a failed test into a pass, nor skip one", () => {
    expect(
      issues({ ...ok, criteria: [{ ...ok.criteria[0], verdict: "pass" }] }),
    ).toEqual(["El test de r1-c1 ha fallado: el veredicto es fail"]);
    expect(issues({ ...ok, criteria: [] })).toEqual([
      "Faltan los criterios r1-c1",
    ]);
    expect(
      issues({
        ...ok,
        criteria: [...ok.criteria, { ...ok.criteria[0], key: "r1-c2" }],
      }),
    ).toEqual(["r1-c2 no ha fallado: solo explicas los criterios que fallan"]);
  });

  it("every regression goes to a task of the revision", () => {
    expect(issues({ ...ok, regressions: [] })).toEqual([
      "Asigna a una tarea: smoke.spec.ts › lists",
    ]);
    expect(
      issues({ ...ok, regressions: [{ ...ok.regressions[0], task: 5 }] }),
    ).toEqual(["La tarea 5 no está en esta revisión"]);
  });
});
