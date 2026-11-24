import { describe, expect, it } from "vitest";
import {
  planSchema,
  planSchemaFor,
  type Plan,
  type PlanTask,
} from "./contracts";

const task = (over: Partial<PlanTask> = {}): PlanTask => ({
  title: "Añadir el NIF",
  description: "Añade la columna nif a clients",
  files: ["src/db/schema.ts"],
  acceptanceCriteria: [{ id: "c1", type: "e2e", text: "Se ve el NIF" }],
  ...over,
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  feasible: true,
  summary: "Añade el NIF a los clientes",
  assumptions: [],
  tasks: [task()],
  ...over,
});

const messages = (value: unknown, schema = planSchema) => {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("planSchema (D28)", () => {
  it("accepts a feasible plan with 1 to 4 tasks", () => {
    expect(messages(plan())).toEqual([]);
    expect(
      messages(
        plan({
          tasks: [1, 2, 3, 4].map((n) =>
            task({
              acceptanceCriteria: [{ id: `c${n}`, type: "visual", text: "x" }],
            }),
          ),
        }),
      ),
    ).toEqual([]);
  });

  it("rejects a feasible plan without tasks or with more than 4", () => {
    expect(messages(plan({ tasks: [] }))).toHaveLength(1);
    expect(
      planSchema.safeParse(plan({ tasks: Array(5).fill(task()) })).success,
    ).toBe(false);
  });

  it("a not feasible plan needs a reason and no tasks", () => {
    const rejected = plan({
      feasible: false,
      rejectionReason: "Toca .github/",
      tasks: [],
    });
    expect(messages(rejected)).toEqual([]);
    expect(messages({ ...rejected, rejectionReason: " " })).toEqual([
      "Si feasible es false, rejectionReason es obligatorio",
    ]);
    expect(messages({ ...rejected, tasks: [task()] })).toEqual([
      "Si feasible es false, tasks debe estar vacío",
    ]);
  });

  it("checks the planned files against paths.ts (D16)", () => {
    expect(
      messages(plan({ tasks: [task({ files: [".github/workflows/x.yml"] })] })),
    ).toEqual(["Develop no puede modificar .github/workflows/x.yml (D16)"]);
  });

  it("criterion ids are unique across the plan and look like c1", () => {
    expect(messages(plan({ tasks: [task(), task()] }))).toEqual([
      "El id de criterio c1 está repetido",
    ]);
    expect(
      messages(
        plan({
          tasks: [
            task({ acceptanceCriteria: [{ id: "A", type: "e2e", text: "x" }] }),
          ],
        }),
      ),
    ).toEqual(["El id de un criterio es c1, c2, c3…"]);
  });

  it("a new page must be added to e2e/pages.ts", () => {
    const tree = ["src/app/(crm)/clientes/page.tsx", "e2e/pages.ts"];
    const schema = planSchemaFor(tree);
    const page = "src/app/(crm)/contacto/page.tsx";
    expect(
      messages(plan({ tasks: [task({ files: [page] })] }), schema),
    ).toEqual([
      `El plan crea ${page}: una tarea debe incluir e2e/pages.ts para que salga en las capturas`,
    ]);
    expect(
      messages(
        plan({ tasks: [task({ files: [page, "e2e/pages.ts"] })] }),
        schema,
      ),
    ).toEqual([]);
    // Editing an existing page is fine.
    expect(
      messages(
        plan({ tasks: [task({ files: ["src/app/(crm)/clientes/page.tsx"] })] }),
        schema,
      ),
    ).toEqual([]);
  });
});
