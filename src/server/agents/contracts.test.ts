import { describe, expect, it } from "vitest";
import {
  developOutputSchema,
  developSchemaFor,
  planSchema,
  planSchemaFor,
  splitSchemaFor,
  type Criterion,
  type DevelopOutput,
  type Plan,
  type PlanTask,
} from "./contracts";

const task = (over: Partial<PlanTask> = {}): PlanTask => ({
  title: "Añadir el NIF",
  description: "Añade la columna nif a clients",
  files: ["src/db/schema.ts"],
  references: ["src/db/schema.ts"],
  acceptanceCriteria: [
    { id: "c1", type: "e2e", text: "Se ve el NIF", testIds: ["clients-table"] },
  ],
  ...over,
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  feasible: true,
  summary: "Añade el NIF a los clientes",
  assumptions: [],
  tasks: [task()],
  ...over,
});

const messages = (
  value: unknown,
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: { message: string }[] };
    };
  } = planSchema,
) => {
  const r = schema.safeParse(value);
  return r.success ? [] : (r.error?.issues ?? []).map((i) => i.message);
};

describe("planSchema (D28)", () => {
  it("accepts a feasible plan with 1 to 4 tasks", () => {
    expect(messages(plan())).toEqual([]);
    expect(
      messages(
        plan({
          tasks: [1, 2, 3, 4].map((n) =>
            task({
              acceptanceCriteria: [
                {
                  id: `c${n}`,
                  type: "e2e",
                  text: "x",
                  testIds: ["clients-table"],
                },
              ],
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
            task({
              acceptanceCriteria: [
                { id: "A", type: "e2e", text: "x", testIds: ["clients-table"] },
              ],
            }),
          ],
        }),
      ),
    ).toEqual(["El id de un criterio es c1, c2, c3…"]);
  });

  it("a new page must be added to e2e/pages.ts", () => {
    const tree = [
      "src/app/(crm)/clientes/page.tsx",
      "e2e/pages.ts",
      "src/db/schema.ts",
    ];
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

describe("references (extra of D28)", () => {
  const tree = ["src/db/schema.ts", "src/app/(crm)/clientes/client-form.tsx"];

  it("need 1 to 3 files", () => {
    expect(messages(plan({ tasks: [task({ references: [] })] }))).toHaveLength(
      1,
    );
    expect(
      planSchema.safeParse(
        plan({ tasks: [task({ references: ["a", "b", "c", "d"] })] }),
      ).success,
    ).toBe(false);
  });

  it("must exist in the tree", () => {
    const schema = planSchemaFor(tree);
    expect(messages(plan(), schema)).toEqual([]);
    expect(
      messages(
        plan({ tasks: [task({ references: ["src/app/(crm)/nope.tsx"] })] }),
        schema,
      ),
    ).toEqual([
      "La referencia src/app/(crm)/nope.tsx no existe en el árbol: elige un archivo que ya exista",
    ]);
  });
});

describe("splitSchemaFor (D34)", () => {
  const criteria: Criterion[] = [
    {
      id: "c3",
      type: "e2e",
      text: "El formulario tiene field-nif",
      testIds: ["clients-table"],
    },
    {
      id: "c4",
      type: "visual",
      text: "La lista muestra el NIF",
      testIds: ["clients-table"],
    },
  ];
  const tree = ["src/db/schema.ts"];
  const sub = (cs: Criterion[]) => task({ acceptanceCriteria: cs });
  const split = (tasks: PlanTask[]) => ({ reason: "No cabía", tasks });
  const schema = splitSchemaFor({ acceptanceCriteria: criteria }, tree);

  it("shares the criteria out, unchanged, one subtask each", () => {
    expect(
      messages(split([sub([criteria[0]!]), sub([criteria[1]!])]), schema),
    ).toEqual([]);
  });

  it("a subtask may have no criterion of its own", () => {
    expect(messages(split([sub(criteria), sub([])]), schema)).toEqual([]);
  });

  it("rejects missing, repeated, changed and new criteria", () => {
    expect(messages(split([sub([criteria[0]!]), sub([])]), schema)).toEqual([
      "Faltan criterios de la tarea original: c4",
    ]);
    expect(
      messages(split([sub(criteria), sub([criteria[1]!])]), schema),
    ).toEqual(["El criterio c4 está en más de una subtarea"]);
    expect(
      messages(
        split([sub([criteria[0]!]), sub([{ ...criteria[1]!, text: "Otro" }])]),
        schema,
      ),
    ).toEqual([
      "El criterio c4 ha cambiado: cópialo tal cual (visual: La lista muestra el NIF; testIds: clients-table)",
    ]);
    expect(
      messages(
        split([
          sub(criteria),
          sub([
            {
              id: "c9",
              type: "e2e",
              text: "Nuevo",
              testIds: ["clients-table"],
            },
          ]),
        ]),
        schema,
      ),
    ).toEqual([
      "El criterio c9 no es de la tarea original: no añadas criterios",
    ]);
  });

  it("takes 2 or 3 subtasks, fewer when the plan is near 6 tasks", () => {
    expect(
      splitSchemaFor({ acceptanceCriteria: criteria }, tree).safeParse(
        split([sub(criteria)]),
      ).success,
    ).toBe(false);
    const tight = splitSchemaFor({ acceptanceCriteria: criteria }, tree, 2);
    expect(
      messages(
        split([sub([criteria[0]!]), sub([criteria[1]!]), sub([])]),
        tight,
      ),
    ).toEqual([
      "El plan no puede pasar de 6 tareas: divide en 2 subtareas como mucho",
    ]);
  });

  it("checks paths and references like the plan", () => {
    expect(
      messages(
        split([
          task({ files: ["drizzle/0005.sql"], acceptanceCriteria: criteria }),
          task({ references: ["nope.ts"], acceptanceCriteria: [] }),
        ]),
        schema,
      ),
    ).toEqual([
      "Develop no puede modificar drizzle/0005.sql (D16)",
      "La referencia nope.ts no existe en el árbol: elige un archivo que ya exista",
    ]);
  });
});

describe("Develop output (D34)", () => {
  const output = (over: Partial<DevelopOutput> = {}): DevelopOutput => ({
    commitMessage: "feat(clients): add tax id field",
    files: [{ path: "src/db/schema.ts", content: "export {};\n" }],
    notes: "Añadida la columna nif.",
    ...over,
  });
  const scope = {
    tree: ["src/db/schema.ts", "src/lib/money.ts"],
    seen: ["src/db/schema.ts"],
    criteria: ["c1"],
  };

  it("accepts files it has seen and new files", () => {
    const schema = developSchemaFor(scope);
    expect(messages(output(), schema)).toEqual([]);
    expect(
      messages(
        output({
          files: [
            { path: "src/db/schema.ts", content: "x" },
            { path: "src/app/(crm)/contacto/page.tsx", content: "y" },
          ],
          evidence: [{ criterion: "c1", hint: "data-testid=field-nif" }],
        }),
        schema,
      ),
    ).toEqual([]);
  });

  it("never overwrites an existing file it has not seen", () => {
    expect(
      messages(
        output({ files: [{ path: "src/lib/money.ts", content: "x" }] }),
        developSchemaFor(scope),
      ),
    ).toEqual([
      "src/lib/money.ts ya existe y no lo has recibido: no lo sobrescribas. Escribe solo archivos que hayas recibido o archivos nuevos",
    ]);
  });

  it("checks the commit message, paths, sizes and evidence ids", () => {
    const schema = developSchemaFor(scope);
    expect(
      messages(output({ commitMessage: "Added the NIF" }), schema),
    ).toHaveLength(1);
    expect(
      messages(
        output({ commitMessage: "feat: add nif\n\nLonger body." }),
        schema,
      ),
    ).toEqual([]);
    expect(
      messages(
        output({
          files: [
            { path: "../x.ts", content: "" },
            { path: "a.ts", content: "" },
            { path: "a.ts", content: "" },
            { path: "big.ts", content: "x".repeat(61 * 1024) },
          ],
          evidence: [{ criterion: "c7", hint: "x" }],
        }),
        schema,
      ),
    ).toEqual([
      "Ruta no válida: ../x.ts",
      "El archivo a.ts está repetido",
      "big.ts pasa de 60 KB",
      "El criterio c7 no es de esta tarea",
    ]);
  });

  it("in iteration 1 an answer that changes nothing goes to repair (D34)", () => {
    const same = output({
      files: [{ path: "src/db/schema.ts", content: "export {};\r\n" }],
    });
    const current = { "src/db/schema.ts": "export {};" };
    expect(
      messages(
        same,
        developSchemaFor({ ...scope, current, requireChange: true }),
      ),
    ).toEqual([
      "Ningún archivo cambia respecto al que has recibido: haz el cambio que pide la tarea",
    ]);
    // Later iterations: the engine counts it as a failed iteration instead.
    expect(messages(same, developSchemaFor({ ...scope, current }))).toEqual([]);
  });

  it("without the scope only checks the shape, and leaves forbidden paths to the engine (D16)", () => {
    expect(
      messages(
        output({ files: [{ path: ".github/workflows/x.yml", content: "" }] }),
        developOutputSchema,
      ),
    ).toEqual([]);
    expect(developOutputSchema.safeParse(output({ files: [] })).success).toBe(
      false,
    );
    expect(
      developOutputSchema.safeParse({ ...output(), notes: undefined }).success,
    ).toBe(false);
  });
});

describe("criteria for Testing (D38, D39)", () => {
  it("every criterion lists its data-testid, in kebab-case", () => {
    const noIds = task({
      acceptanceCriteria: [
        { id: "c1", type: "e2e", text: "x" } as unknown as Criterion,
      ],
    });
    expect(planSchema.safeParse(plan({ tasks: [noIds] })).success).toBe(false);
    const css = task({
      acceptanceCriteria: [
        { id: "c1", type: "e2e", text: "x", testIds: ["#filter"] },
      ],
    });
    expect(messages(plan({ tasks: [css] }))).toEqual([
      "Un data-testid va en kebab-case: invoice-status-filter",
    ]);
  });

  it("rejects visual criteria for now, so they go to repair (D39)", () => {
    const visual = task({
      acceptanceCriteria: [
        { id: "c1", type: "visual", text: "Se ve en rojo", testIds: ["x"] },
      ],
    });
    expect(messages(plan({ tasks: [visual] }))[0]).toContain(
      "es de tipo visual",
    );
  });

  it("Develop must use the criteria's data-testid", () => {
    const scope = {
      tree: ["src/app/a.tsx"],
      seen: ["src/app/a.tsx"],
      current: { "src/app/a.tsx": '<table data-testid="invoices-table" />' },
      testIds: ["invoices-table", "invoice-status-filter", "field-notes"],
    };
    const out = (content: string): DevelopOutput => ({
      commitMessage: "feat(invoices): add status filter",
      files: [{ path: "src/app/a.tsx", content }],
      notes: "Filtro",
    });
    const schema = developSchemaFor(scope);
    expect(
      messages(
        out(
          '<select data-testid="invoice-status-filter" /><Field name="notes" />',
        ),
        schema,
      ),
    ).toEqual([]);
    expect(messages(out("<select />"), schema)[0]).toContain(
      "Faltan data-testid que piden los criterios: invoice-status-filter, field-notes",
    );
  });
});
