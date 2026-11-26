import { z } from "zod";
import type { DevelopContext } from "./develop-context";
import { normalizeContent } from "./files";
import { checkPaths, normalizePath, PAGES_FILE } from "./paths";
import { usesTestId } from "./test-ids";

/**
 * Agent contracts (D8, D24). Every LLM output is validated against these
 * schemas; from H4 on only the provider and the prompts change.
 */

export const AGENTS = ["orchestrator", "develop", "testing"] as const;
export type AgentName = (typeof AGENTS)[number];

// --- Orchestrator ---

/**
 * Acceptance criterion: checked in the DOM (e2e) or in the screenshots
 * (visual). `visual` stays in the contract for later, but the plan refinement
 * rejects it for now (D39).
 */
export const CRITERION_TYPES = ["e2e", "visual"] as const;

/** A data-testid: kebab-case, as in crm-demo's AGENTS.md. */
export const testIdSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Un data-testid va en kebab-case: invoice-status-filter",
  );
export const MAX_CRITERION_TEST_IDS = 6;

export const criterionSchema = z.object({
  id: z
    .string()
    .regex(/^c[0-9]{1,2}$/, "El id de un criterio es c1, c2, c3…")
    .describe("Identificador único en todo el plan: c1, c2, c3…"),
  type: z
    .enum(CRITERION_TYPES)
    .describe(
      "e2e: se comprueba en el DOM de la vista previa con data-testid. visual: todavía no se admite.",
    ),
  text: z
    .string()
    .min(1)
    .max(300)
    .describe("Criterio comprobable, en español."),
  testIds: z
    .array(testIdSchema)
    .min(1)
    .max(MAX_CRITERION_TEST_IDS)
    .describe(
      "Los data-testid con los que Testing comprueba el criterio, nuevos o existentes. Develop tiene que usarlos tal cual (D38).",
    ),
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
      if (c.type !== "e2e") {
        issue(
          `El criterio ${c.id} es de tipo ${c.type}: por ahora todos los criterios son e2e y se comprueban en el DOM con data-testid (D39)`,
          ["tasks", t, "acceptanceCriteria", i, "type"],
        );
      }
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

/** The split without the checks against the original task and the tree. */
export const splitBaseSchema = splitObject;

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
        } else if (
          before.type !== c.type ||
          before.text !== c.text ||
          before.testIds.join() !== c.testIds.join()
        ) {
          issue(
            `El criterio ${c.id} ha cambiado: cópialo tal cual (${before.type}: ${before.text}; testIds: ${before.testIds.join(", ")})`,
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

/** Input of a split (D34, extra of D29). */
export type SplitInput = {
  runId: number;
  request: string;
  mode: "split";
  planRevision: number;
  /** The task whose answer did not fit. */
  task: TaskBrief;
  /** Why: the cut answer and its output limit. */
  reason: string;
  /** The other tasks of the plan, untouched. */
  others: { position: number; title: string; files: string[] }[];
  /** 2 or 3, fewer when the plan is near MAX_TASKS_AFTER_SPLIT. */
  maxTasks: number;
  context: PlanContext;
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
  /** Content of the seen files, to tell an answer that changes nothing. */
  current?: Readonly<Record<string, string>>;
  /**
   * Iteration 1: an answer that changes nothing is a contract error and goes
   * to the repair call. Later it just counts as a failed iteration (D34).
   */
  requireChange?: boolean;
  /**
   * New data-testid of the task's criteria (D38, see requiredTestIds): each
   * must appear in the files Develop returns or in the files it has seen.
   */
  testIds?: readonly string[];
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
  const current = scope?.current;
  if (
    scope?.requireChange &&
    current &&
    out.files.every(
      (f) =>
        current[f.path] !== undefined &&
        normalizeContent(current[f.path]!) === normalizeContent(f.content),
    )
  ) {
    issue(
      "Ningún archivo cambia respecto al que has recibido: haz el cambio que pide la tarea",
      ["files"],
    );
  }
  if (scope?.testIds?.length) {
    const texts = [
      ...out.files.map((f) => f.content),
      ...Object.values(current ?? {}),
    ];
    const missing = scope.testIds.filter((id) => !usesTestId(id, texts));
    if (missing.length > 0) {
      issue(
        `Faltan data-testid que piden los criterios: ${missing.join(", ")}. Úsalos tal cual, por ejemplo data-testid="${missing[0]}"`,
        ["files"],
      );
    }
  }
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
  /** Why the previous iteration failed: Testing or pr-check (D32, D33). */
  feedback: string | null;
  /** What Develop reads from crm-demo for this task (D32). */
  context: DevelopContext;
};

// --- Testing (D38, D39) ---

/** A step of the criteria runner (e2e/criteria.spec.ts in crm-demo). */
const nth = z
  .number()
  .int()
  .min(0)
  .max(50)
  .optional()
  .describe("Índice entre los visibles con ese data-testid; 0 si se omite.");
const stepText = z.string().min(1).max(200);
const relativePath = z
  .string()
  .max(200)
  .regex(
    /^\/(?!\/)[^\s:\\]*$/,
    "Una ruta relativa como /facturas: sin esquema, sin host y sin espacios",
  );

export const stepSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("goto"),
    page: z
      .string()
      .optional()
      .describe(
        "Nombre de una página de e2e/pages.ts (abre las de detalle desde su lista).",
      ),
    path: relativePath
      .optional()
      .describe("O una ruta relativa: /facturas, /clientes/nuevo."),
  }),
  z.strictObject({
    action: z.literal("fill"),
    testId: testIdSchema,
    value: z
      .string()
      .max(200)
      .describe("{{stamp}} se sustituye por un valor único."),
    nth,
  }),
  z.strictObject({
    action: z.literal("select"),
    testId: testIdSchema,
    value: z
      .string()
      .max(200)
      .describe(
        'El value exacto de la opción del <select>; "" si la opción tiene value vacío.',
      ),
    nth,
  }),
  z.strictObject({ action: z.literal("click"), testId: testIdSchema, nth }),
  z.strictObject({
    action: z.literal("expectVisible"),
    testId: testIdSchema,
    nth,
  }),
  z.strictObject({
    action: z.literal("expectText"),
    testId: testIdSchema,
    text: stepText.describe("Texto que contiene el elemento ({{stamp}} vale)."),
    nth,
    all: z
      .boolean()
      .optional()
      .describe(
        "true: todos los visibles con ese data-testid contienen el texto.",
      ),
  }),
  z.strictObject({
    action: z.literal("expectCount"),
    testId: testIdSchema,
    count: z
      .number()
      .int()
      .min(0)
      .max(200)
      .optional()
      .describe("Número exacto."),
    min: z.number().int().min(0).max(200).optional().describe("O un mínimo."),
  }),
]);
export type Step = z.infer<typeof stepSchema>;
export const MAX_STEPS = 20;

/** Steps of every e2e criterion of one plan revision (D38). */
const stepsObject = z.object({
  criteria: z
    .array(
      z.object({
        id: z.string().describe("Id del criterio: c1, c2…"),
        steps: z.array(stepSchema).min(1).max(MAX_STEPS),
      }),
    )
    .min(1),
});
export type CriteriaSteps = z.infer<typeof stepsObject>;

/** A criterion Testing writes steps for. */
export type StepsCriterion = {
  id: string;
  task: number;
  text: string;
  testIds: string[];
};

export type StepsScope = {
  criteria: readonly Pick<StepsCriterion, "id" | "testIds">[];
  /** Names of e2e/pages.ts at the head the steps are written for. */
  pages: readonly string[];
};

/** Mirrors the runner: what a JSON Schema cannot say, plus the plan's ids. */
function refineSteps(
  out: CriteriaSteps,
  ctx: z.RefinementCtx,
  scope: StepsScope | null,
) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: "custom", message, path });
  const byId = new Map(scope?.criteria.map((c) => [c.id, c]));
  const planIds = new Set(scope?.criteria.flatMap((c) => c.testIds));
  const seen = new Set<string>();
  out.criteria.forEach((c, i) => {
    if (seen.has(c.id))
      issue(`El criterio ${c.id} está repetido`, ["criteria", i, "id"]);
    seen.add(c.id);
    const criterion = byId.get(c.id);
    if (scope && !criterion) {
      issue(`${c.id} no es un criterio de esta revisión`, [
        "criteria",
        i,
        "id",
      ]);
    }
    if (c.steps[0]?.action !== "goto") {
      issue("El primer paso es siempre un goto", ["criteria", i, "steps", 0]);
    }
    if (!c.steps.some((s) => s.action.startsWith("expect"))) {
      issue(`${c.id} no comprueba nada: añade algún expect`, [
        "criteria",
        i,
        "steps",
      ]);
    }
    c.steps.forEach((step, j) => {
      const path = ["criteria", i, "steps", j];
      if (step.action === "goto") {
        if (!step.page === !step.path) {
          issue("goto lleva page o path, uno de los dos", path);
        } else if (step.page && scope && !scope.pages.includes(step.page)) {
          issue(
            `La página ${step.page} no está en e2e/pages.ts (${scope.pages.join(", ")}): usa path`,
            path,
          );
        }
        return;
      }
      // The runner only substitutes {{stamp}}: anything else is literal text.
      const text =
        step.action === "fill"
          ? step.value
          : step.action === "expectText"
            ? step.text
            : "";
      const unknown = text.match(/\{\{(?!stamp\}\})[^}]*\}\}/);
      if (unknown) {
        issue(
          `${unknown[0]} no existe: el único comodín es {{stamp}}. Para un valor que no conoces, usa expectVisible`,
          path,
        );
      }
      // crm-demo's rows are not links (the name is): clicking one stays put.
      if (step.action === "click" && step.testId.endsWith("-row")) {
        issue(
          `Pulsar ${step.testId} no navega: abre el detalle con goto y su page de e2e/pages.ts`,
          path,
        );
      }
      if (step.action === "expectCount" && step.min === 0) {
        issue(
          "expectCount con min 0 siempre se cumple: usa count, un min mayor o expectText con all",
          path,
        );
      }
      if (
        step.action === "expectCount" &&
        (step.count === undefined) === (step.min === undefined)
      ) {
        issue("expectCount lleva count o min, uno de los dos", path);
      }
      // D38: the data-testid of the plan, the only ones Develop must write.
      if (scope && !planIds.has(step.testId)) {
        issue(
          `${step.testId} no está entre los data-testid del plan: usa solo ${[...planIds].join(", ")}`,
          [...path, "testId"],
        );
      }
    });
  });
  const missing = [...byId.keys()].filter((id) => !seen.has(id));
  if (missing.length > 0) {
    issue(`Faltan los pasos de ${missing.join(", ")}`, ["criteria"]);
  }
}

export const stepsSchema = stepsObject.superRefine((o, ctx) =>
  refineSteps(o, ctx, null),
);
export const stepsSchemaFor = (scope: StepsScope) =>
  stepsObject.superRefine((o, ctx) => refineSteps(o, ctx, scope));

export type StepsInput = {
  runId: number;
  request: string;
  planRevision: number;
  tasks: { position: number; title: string; description: string }[];
  criteria: StepsCriterion[];
  pages: string[];
  /** Existing specs of crm-demo as examples of the flows (write-flow…). */
  examples: { path: string; content: string }[];
};

/** Result of one criterion on one project, from results.json (D39). */
export type CriterionResult = {
  /** r<revision>-<criterion>: ids restart in an amend (D29). */
  key: string;
  run: number;
  revision: number;
  criterion: string;
  project: string;
  passed: boolean;
  error: string | null;
  /** Saved by the runner when a step fails. */
  failedStep: { step: number; action: string; url: string } | null;
  snapshot: string | null;
};

/** Testing's explanation of the failures of one E2E report (D39). */
const explainObject = z.object({
  criteria: z
    .array(
      z.object({
        key: z.string().describe("Clave del criterio: r1-c2."),
        task: z
          .number()
          .int()
          .describe("Posición de la tarea a la que vuelve."),
        verdict: z.enum(["pass", "fail"]),
        reason: z
          .string()
          .min(1)
          .max(600)
          .describe(
            "En español, para Develop: qué falta o qué está mal, sin copiar los pasos.",
          ),
        evidence: z.string().max(300).describe("El paso que falló, tal cual."),
      }),
    )
    .describe("Un elemento por cada criterio que ha fallado."),
  regressions: z
    .array(
      z.object({
        test: z.string().describe("Título del test que falla."),
        task: z
          .number()
          .int()
          .describe("Tarea de esta revisión que lo ha roto."),
        reason: z.string().min(1).max(600),
      }),
    )
    .describe(
      "Un elemento por cada test que falla y no es un criterio de esta revisión.",
    ),
});
export type TestingExplanation = z.infer<typeof explainObject>;
/** For a stored explanation, already checked against its input (D22). */
export const explainSchemaLoose = explainObject;

export type ExplainInput = {
  runId: number;
  request: string;
  /** Tasks under test, with the files their commit touched. */
  tasks: { position: number; title: string; files: string[] }[];
  /** Failed criteria of this run, one per key (worst project). */
  failed: (CriterionResult & { task: number; text: string })[];
  /** Other failing tests: E2E that already existed or older runs' criteria. */
  regressions: { title: string; project: string; error: string }[];
};

/** The executor decides the verdict; Testing only explains it (D39). */
export function explainSchemaFor(input: ExplainInput) {
  const failedKeys = new Set(input.failed.map((f) => f.key));
  const taskSet = new Set(input.tasks.map((t) => t.position));
  const titles = new Set(input.regressions.map((r) => r.title));
  return explainObject.superRefine((out, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });
    const seen = new Set<string>();
    out.criteria.forEach((c, i) => {
      seen.add(c.key);
      if (!failedKeys.has(c.key)) {
        issue(
          `${c.key} no ha fallado: solo explicas los criterios que fallan`,
          ["criteria", i, "key"],
        );
      } else if (c.verdict !== "fail") {
        issue(`El test de ${c.key} ha fallado: el veredicto es fail`, [
          "criteria",
          i,
          "verdict",
        ]);
      }
      if (!taskSet.has(c.task)) {
        issue(`La tarea ${c.task} no está en esta revisión`, [
          "criteria",
          i,
          "task",
        ]);
      }
    });
    const missing = [...failedKeys].filter((k) => !seen.has(k));
    if (missing.length)
      issue(`Faltan los criterios ${missing.join(", ")}`, ["criteria"]);
    const assigned = new Set<string>();
    out.regressions.forEach((r, i) => {
      assigned.add(r.test);
      if (!titles.has(r.test))
        issue(`${r.test} no es un test que falla`, ["regressions", i, "test"]);
      if (!taskSet.has(r.task))
        issue(`La tarea ${r.task} no está en esta revisión`, [
          "regressions",
          i,
          "task",
        ]);
    });
    const unassigned = [...titles].filter((t) => !assigned.has(t));
    if (unassigned.length)
      issue(`Asigna a una tarea: ${unassigned.join(", ")}`, ["regressions"]);
  });
}
