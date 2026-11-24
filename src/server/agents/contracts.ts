import { z } from "zod";
import { checkPaths, PAGES_FILE } from "./paths";

/**
 * Agent contracts (D8, D24). Every LLM output is validated against these
 * schemas; from H4 on only the provider and the prompts change.
 */

export const AGENTS = ["orchestrator", "develop", "testing"] as const;
export type AgentName = (typeof AGENTS)[number];

// --- Orchestrator ---

/** Acceptance criterion: checked in the DOM (e2e) or in the screenshots (visual). */
export const CRITERION_TYPES = ["e2e", "visual"] as const;

export const criterionSchema = z.object({
  id: z
    .string()
    .regex(/^c[0-9]{1,2}$/, "El id de un criterio es c1, c2, c3…")
    .describe("Identificador único en todo el plan: c1, c2, c3…"),
  type: z
    .enum(CRITERION_TYPES)
    .describe(
      "e2e: se comprueba en el DOM con data-testid. visual: se comprueba en las capturas a 1280 y 390 px.",
    ),
  text: z
    .string()
    .min(1)
    .max(300)
    .describe("Criterio comprobable, en español."),
});
export type Criterion = z.infer<typeof criterionSchema>;

export const MAX_PLAN_TASKS = 4;

export const planTaskSchema = z.object({
  title: z.string().min(1).max(120).describe("Título corto, en español."),
  description: z
    .string()
    .min(1)
    .max(3000)
    .describe(
      "Instrucciones para Develop, en español: qué cambiar, en qué archivos y con qué data-testid.",
    ),
  files: z
    .array(z.string().min(1).max(300))
    .min(1)
    .max(10)
    .describe("Rutas del repo que la tarea prevé crear o modificar."),
  acceptanceCriteria: z.array(criterionSchema).min(1).max(6),
});
export type PlanTask = z.infer<typeof planTaskSchema>;

const planObject = z.object({
  feasible: z
    .boolean()
    .describe(
      "false si la petición queda fuera de alcance: no es del CRM, toca rutas prohibidas o necesita claves o servicios de pago.",
    ),
  rejectionReason: z
    .string()
    .max(1000)
    .optional()
    .describe("Solo si feasible es false: motivo para el cliente, en español."),
  summary: z
    .string()
    .min(1)
    .max(2000)
    .describe("Resumen del plan para el cliente, en español."),
  assumptions: z
    .array(z.string().min(1).max(300))
    .max(8)
    .describe("Supuestos que has tenido que hacer, en español."),
  tasks: z
    .array(planTaskSchema)
    .max(MAX_PLAN_TASKS)
    .describe("De 1 a 4 tareas si feasible es true; ninguna si es false."),
});

/** A new page (a page.tsx that is not in the tree yet). */
export const isNewPage = (path: string, tree: ReadonlySet<string>) =>
  /^src\/app\/.*page\.tsx$/.test(path) && !tree.has(path);

/**
 * Checks of D28 that a JSON Schema cannot express. With `tree` (the paths of
 * crm-demo at the base sha) it also checks that new pages are captured.
 */
function refinePlan(
  plan: z.infer<typeof planObject>,
  ctx: z.RefinementCtx,
  tree: ReadonlySet<string> | null,
) {
  const issue = (message: string, path: (string | number)[] = []) =>
    ctx.addIssue({ code: "custom", message, path });
  if (!plan.feasible) {
    if (!plan.rejectionReason?.trim()) {
      issue("Si feasible es false, rejectionReason es obligatorio", [
        "rejectionReason",
      ]);
    }
    if (plan.tasks.length > 0) {
      issue("Si feasible es false, tasks debe estar vacío", ["tasks"]);
    }
    return;
  }
  if (plan.tasks.length === 0) {
    issue(`Un plan viable tiene de 1 a ${MAX_PLAN_TASKS} tareas`, ["tasks"]);
  }
  const ids = new Set<string>();
  plan.tasks.forEach((task, t) => {
    const check = checkPaths(task.files);
    if (!check.ok) issue(check.reason, ["tasks", t, "files"]);
    task.acceptanceCriteria.forEach((c, i) => {
      if (ids.has(c.id)) {
        issue(`El id de criterio ${c.id} está repetido`, [
          "tasks",
          t,
          "acceptanceCriteria",
          i,
          "id",
        ]);
      }
      ids.add(c.id);
    });
  });
  if (tree) {
    const pages = plan.tasks.flatMap((t) =>
      t.files.filter((f) => isNewPage(f, tree)),
    );
    const captured = plan.tasks.some((t) => t.files.includes(PAGES_FILE));
    if (pages.length > 0 && !captured) {
      issue(
        `El plan crea ${pages.join(", ")}: una tarea debe incluir ${PAGES_FILE} para que salga en las capturas`,
        ["tasks"],
      );
    }
  }
}

/** Plan of the orchestrator (D28), without the checks against the tree. */
export const planSchema = planObject.superRefine((plan, ctx) =>
  refinePlan(plan, ctx, null),
);
export type Plan = z.infer<typeof planSchema>;

/** planSchema plus the checks that need the paths of crm-demo. */
export const planSchemaFor = (tree: readonly string[]) => {
  const set = new Set(tree);
  return planObject.superRefine((plan, ctx) => refinePlan(plan, ctx, set));
};

/** What the orchestrator reads from crm-demo at the base sha (D27). */
export type PlanContext = {
  baseSha: string;
  /** Every file path of the repo, minus agent-runs/. */
  tree: string[];
  files: { path: string; content: string }[];
};

/** Task of the previous revision, for an amend replan (D29). */
export type PreviousTask = {
  position: number;
  title: string;
  status: string;
  lastFeedback: string | null;
  acceptanceCriteria: Criterion[];
};

export type PlanInput = {
  runId: number;
  request: string;
  planRevision: number;
  /**
   * replace: no code yet, a full plan replaces the previous one.
   * amend: the branch has code, only new or corrective tasks (D29).
   */
  mode: "replace" | "amend";
  /** Client feedback on the previous plan or preview (D9). */
  feedback: string | null;
  previous: { summary: string; tasks: PreviousTask[] } | null;
  context: PlanContext;
};

// --- Develop ---

export const developOutputSchema = z.object({
  commitMessage: z.string().min(1).max(200),
  /** Complete file contents: the panel never applies diffs. */
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        content: z.string().max(200_000),
      }),
    )
    .min(1)
    .max(20),
});
export type DevelopOutput = z.infer<typeof developOutputSchema>;

export type TaskBrief = {
  position: number;
  title: string;
  description: string;
  files: string[];
  acceptanceCriteria: Criterion[];
};

export type DevelopInput = {
  runId: number;
  request: string;
  task: TaskBrief;
  iteration: number;
  /** Testing feedback from the previous iteration. */
  feedback: string | null;
};

// --- Testing ---

export const verdictSchema = z.object({
  passed: z.boolean(),
  summary: z.string().min(1).max(2000),
  criteria: z.array(
    z.object({
      /** Criterion id (c1, c2…) of the task. */
      id: z.string(),
      criterion: z.string(),
      passed: z.boolean(),
      note: z.string().max(1000),
    }),
  ),
});
export type TestingVerdict = z.infer<typeof verdictSchema>;

export type E2eSummary = {
  /** passed | failed | error (see test_reports.status) */
  status: string;
  passed: number;
  failed: number;
  failures: { title: string; project: string; error: string }[];
};

export type TestingInput = {
  runId: number;
  task: TaskBrief;
  iteration: number;
  report: E2eSummary;
};
