import { z } from "zod";
import { checkPaths, normalizePath, PAGES_FILE } from "./paths";

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
/** After a split (D34) a plan may grow up to this many tasks (D28). */
export const MAX_TASKS_AFTER_SPLIT = 6;
export const MAX_REFERENCES = 3;

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
  references: z
    .array(z.string().min(1).max(300))
    .min(1)
    .max(MAX_REFERENCES)
    .describe(
      "De 1 a 3 archivos que ya existen en el árbol y sirven de modelo a Develop: por ejemplo, una página y sus actions para una página nueva, o el formulario de cliente para un campo nuevo.",
    ),
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

/**
 * Checks of one task: planned files against paths.ts and, with the tree,
 * references that exist (extra of D28).
 */
function refineTask(
  task: PlanTask,
  ctx: z.RefinementCtx,
  tree: ReadonlySet<string> | null,
  path: (string | number)[],
) {
  const check = checkPaths(task.files);
  if (!check.ok) {
    ctx.addIssue({
      code: "custom",
      message: check.reason,
      path: [...path, "files"],
    });
  }
  if (!tree) return;
  task.references.forEach((ref, r) => {
    if (!tree.has(ref)) {
      ctx.addIssue({
        code: "custom",
        message: `La referencia ${ref} no existe en el árbol: elige un archivo que ya exista`,
        path: [...path, "references", r],
      });
    }
  });
}

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
    refineTask(task, ctx, tree, ["tasks", t]);
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

// --- Split (D34, extra of D29) ---

/**
 * A subtask of a split. It may have no criterion of its own: the criteria of
 * the original task are shared out, and one criterion cannot go to two
 * subtasks. Testing evaluates every criterion of the plan anyway (D34).
 */
const splitTaskSchema = planTaskSchema.extend({
  acceptanceCriteria: z.array(criterionSchema).max(6),
});

const splitObject = z.object({
  reason: z
    .string()
    .min(1)
    .max(1000)
    .describe("Cómo has dividido la tarea y por qué, en español."),
  tasks: z
    .array(splitTaskSchema)
    .min(2)
    .max(3)
    .describe("De 2 a 3 subtareas que sustituyen a la original, en orden."),
});
export type Split = z.infer<typeof splitObject>;

/**
 * Subtasks of a task whose answer did not fit (D34). The criteria are shared
 * out but never change: each criterion of the original ends up, unchanged,
 * in exactly one subtask, and no new one appears. maxTasks keeps the plan
 * within MAX_TASKS_AFTER_SPLIT.
 */
export function splitSchemaFor(
  original: { acceptanceCriteria: Criterion[] },
  tree: readonly string[],
  maxTasks = 3,
) {
  const set = new Set(tree);
  const byId = new Map(original.acceptanceCriteria.map((c) => [c.id, c]));
  return splitObject.superRefine((split, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) =>
      ctx.addIssue({ code: "custom", message, path });
    if (split.tasks.length > maxTasks) {
      issue(
        `El plan no puede pasar de ${MAX_TASKS_AFTER_SPLIT} tareas: divide en ${maxTasks} subtareas como mucho`,
        ["tasks"],
      );
    }
    const placed = new Set<string>();
    split.tasks.forEach((task, t) => {
      refineTask(task, ctx, set, ["tasks", t]);
      task.acceptanceCriteria.forEach((c, i) => {
        const path = ["tasks", t, "acceptanceCriteria", i];
        const before = byId.get(c.id);
        if (!before) {
          issue(
            `El criterio ${c.id} no es de la tarea original: no añadas criterios`,
            path,
          );
        } else if (placed.has(c.id)) {
          issue(`El criterio ${c.id} está en más de una subtarea`, path);
        } else if (before.type !== c.type || before.text !== c.text) {
          issue(
            `El criterio ${c.id} ha cambiado: cópialo tal cual (${before.type}: ${before.text})`,
            path,
          );
        }
        placed.add(c.id);
      });
    });
    const missing = [...byId.keys()].filter((id) => !placed.has(id));
    if (missing.length > 0) {
      issue(`Faltan criterios de la tarea original: ${missing.join(", ")}`, [
        "tasks",
      ]);
    }
  });
}

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

export const MAX_DEVELOP_FILES = 8;
/** Per file, in bytes (D34). */
export const MAX_FILE_BYTES = 60 * 1024;

/** Conventional Commits, as in crm-demo (D34). */
const COMMIT_RE =
  /^(feat|fix|refactor|style|test|docs|chore|perf|build)(\([a-z0-9][a-z0-9/-]*\))?!?: \S/;

const developObject = z.object({
  commitMessage: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Mensaje de commit en inglés y en imperativo, con formato Conventional Commits: feat(clients): add tax id field.",
    ),
  files: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .max(300)
          .describe("Ruta del repo, relativa a la raíz."),
        content: z
          .string()
          .describe("Contenido completo del archivo, nunca un diff."),
      }),
    )
    .min(1)
    .max(MAX_DEVELOP_FILES)
    .describe("De 1 a 8 archivos, cada uno con su contenido completo."),
  notes: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "En español, para el humano y para Testing: qué has hecho y qué has supuesto.",
    ),
  evidence: z
    .array(
      z.object({
        criterion: z.string().describe("Id del criterio: c1, c2…"),
        hint: z
          .string()
          .min(1)
          .max(300)
          .describe(
            "Dónde se ve: un data-testid, una ruta o un texto. Es una pista para Testing, no una prueba.",
          ),
      }),
    )
    .max(12)
    .optional(),
});
export type DevelopOutput = z.infer<typeof developObject>;

/** What Develop has seen of the repo, for the checks of D34. */
export type DevelopScope = {
  /** Every path of crm-demo at the head of run/<id>. */
  tree: readonly string[];
  /** Files whose content was in the prompt: planned, references, imports. */
  seen: readonly string[];
  /** Criterion ids of the task, for the evidence hints. */
  criteria?: readonly string[];
};

const bytes = (text: string) => new TextEncoder().encode(text).length;

function refineDevelop(
  out: DevelopOutput,
  ctx: z.RefinementCtx,
  scope: DevelopScope | null,
) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: "custom", message, path });
  const firstLine = out.commitMessage.split("\n")[0] ?? "";
  if (!COMMIT_RE.test(firstLine) || firstLine.length > 100) {
    issue(
      "commitMessage debe seguir Conventional Commits en una primera línea de 100 caracteres como mucho, por ejemplo «feat(clients): add tax id field»",
      ["commitMessage"],
    );
  }
  const tree = scope ? new Set(scope.tree) : null;
  const seen = scope ? new Set(scope.seen) : null;
  const paths = new Set<string>();
  out.files.forEach((file, f) => {
    const path = normalizePath(file.path);
    if (!path) {
      issue(`Ruta no válida: ${file.path}`, ["files", f, "path"]);
      return;
    }
    if (paths.has(path)) {
      issue(`El archivo ${path} está repetido`, ["files", f, "path"]);
    }
    paths.add(path);
    if (bytes(file.content) > MAX_FILE_BYTES) {
      issue(`${path} pasa de 60 KB`, ["files", f, "content"]);
    }
    // Writing a file it has not read would wipe its content blindly (D34).
    if (tree?.has(path) && !seen?.has(path)) {
      issue(
        `${path} ya existe y no lo has recibido: no lo sobrescribas. Escribe solo archivos que hayas recibido o archivos nuevos`,
        ["files", f, "path"],
      );
    }
  });
  if (scope?.criteria && out.evidence) {
    const ids = new Set(scope.criteria);
    out.evidence.forEach((e, i) => {
      if (!ids.has(e.criterion)) {
        issue(`El criterio ${e.criterion} no es de esta tarea`, [
          "evidence",
          i,
          "criterion",
        ]);
      }
    });
  }
}

/**
 * Output of Develop for one task (D24, D34), without the checks that need
 * the repo. The forbidden paths are not here: the engine blocks the run on
 * them instead of repairing (D16).
 */
export const developOutputSchema = developObject.superRefine((out, ctx) =>
  refineDevelop(out, ctx, null),
);

/** developOutputSchema plus the checks against what Develop has seen. */
export const developSchemaFor = (scope: DevelopScope) =>
  developObject.superRefine((out, ctx) => refineDevelop(out, ctx, scope));

export type TaskBrief = {
  position: number;
  title: string;
  description: string;
  files: string[];
  /** Existing files Develop imitates (extra of D28, D32). */
  references: string[];
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
