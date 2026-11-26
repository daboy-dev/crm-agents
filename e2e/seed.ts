/**
 * Sample runs of the panel's E2E (H7, criterion 6), on the E2E Neon branch.
 * Only one run can be active (D11), so each test seeds the state it needs:
 * the ones that wait for the human, plus a done, a cancelled and two queued
 * runs. No state the sweep would move: no step under way, no timeout due, no
 * cleanup pending.
 */

import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { Criterion, CriterionResult } from "@/server/agents/contracts";
import * as schema from "@/server/db/schema";
import { DEMO_REQUESTS } from "@/server/runs/demo-requests";
import { e2eDatabaseUrl } from "./env";

const {
  agentSteps,
  appMeta,
  githubEvents,
  previews,
  prChecks,
  runEvents,
  runs,
  tasks,
  testReports,
} = schema;

export type ActiveState =
  "awaiting_plan_approval" | "awaiting_final_approval" | "blocked";

export const RUN_IDS = {
  done: 101,
  cancelled: 102,
  queued: [103, 104],
  awaiting_plan_approval: 110,
  awaiting_final_approval: 111,
  blocked: 112,
} as const;

const db = () => drizzle(neon(e2eDatabaseUrl()), { schema });
type Db = ReturnType<typeof db>;

const REQUEST = DEMO_REQUESTS[0]!.request;
const PROVIDERS = {
  orchestrator: "mock",
  develop: "mock",
  testing: "mock",
} as const;
const sha = (n: number) => n.toString(16).padStart(40, "e");

const criteria = (n: number): Criterion[] => [
  {
    id: `c${n}`,
    type: "e2e",
    text:
      n === 1
        ? "Al crear un cliente de tipo Empresa, su fila de la lista muestra «Empresa»"
        : "Al filtrar la lista por Empresa, todas las filas muestran «Empresa»",
    testIds:
      n === 1 ? ["client-type", "client-type-badge"] : ["client-type-filter"],
  },
];

const TASKS = [
  {
    position: 1,
    title: "Tipo de cliente en el formulario y la lista",
    description:
      "Añade la columna type (particular o empresa) con su migración, el campo en el formulario y la insignia en la lista.",
    files: [
      "src/db/schema.ts",
      "src/app/clientes/nuevo/page.tsx",
      "src/app/clientes/page.tsx",
    ],
    acceptanceCriteria: criteria(1),
  },
  {
    position: 2,
    title: "Filtro por tipo en la lista de clientes",
    description: "Un desplegable en /clientes que filtra la lista por tipo.",
    files: ["src/app/clientes/page.tsx"],
    acceptanceCriteria: criteria(2),
  },
];

const STEPS = {
  criteria: [
    {
      id: "c1",
      steps: [
        { action: "goto", path: "/clientes/nuevo" },
        { action: "fill", testId: "client-name", value: "Empresa {{stamp}}" },
        { action: "select", testId: "client-type", value: "empresa" },
        { action: "click", testId: "client-submit" },
        { action: "expectText", testId: "client-type-badge", text: "Empresa" },
      ],
    },
    {
      id: "c2",
      steps: [
        { action: "goto", path: "/clientes" },
        { action: "select", testId: "client-type-filter", value: "empresa" },
        {
          action: "expectText",
          testId: "client-type-badge",
          text: "Empresa",
          all: true,
        },
      ],
    },
  ],
};

/** Empties every table the panel reads about runs and the pipeline. */
async function reset(d: Db) {
  await d.execute(
    sql`truncate ${runs}, ${previews}, ${testReports}, ${prChecks}, ${githubEvents} restart identity cascade`,
  );
  await d
    .delete(appMeta)
    .where(sql`${appMeta.key} like 'llm_quota_exhausted:%'`);
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function finishedAndQueued(d: Db) {
  await d.insert(runs).values([
    {
      id: RUN_IDS.done,
      request: REQUEST,
      provider: "mock",
      providers: PROVIDERS,
      status: "done",
      version: 12,
      createdAt: minutesAgo(600),
      statusChangedAt: minutesAgo(540),
    },
    {
      id: RUN_IDS.cancelled,
      request: "Añade el NIF a los clientes",
      provider: "mock",
      providers: PROVIDERS,
      status: "cancelled",
      createdAt: minutesAgo(500),
      statusChangedAt: minutesAgo(480),
    },
    ...RUN_IDS.queued.map((id, i) => ({
      id,
      request: `Petición en cola número ${i + 1} para comprobar su posición`,
      provider: "mock",
      providers: PROVIDERS,
      status: "queued",
      createdAt: minutesAgo(30 - i),
      statusChangedAt: minutesAgo(30 - i),
    })),
  ]);
}

type EventRow = typeof runEvents.$inferInsert;

async function events(
  d: Db,
  runId: number,
  rows: Omit<EventRow, "runId" | "runVersion" | "at">[],
) {
  const start = Date.now() - rows.length * 60_000;
  await d.insert(runEvents).values(
    rows.map((r, i) => ({
      ...r,
      runId,
      runVersion: i,
      at: new Date(start + i * 60_000),
    })),
  );
}

const planEvents = (runId: number) => [
  { actor: "human", kind: "request", message: `Petición: ${REQUEST}` },
  { actor: "system", kind: "started", message: "Arranca el run." },
  {
    actor: "orchestrator",
    kind: "plan",
    message: `Plan (revisión 1) con 2 tareas · run #${runId}`,
    data: {
      calls: [
        {
          // Flash-Lite carries the long fallback note (overflow seen in H7).
          model: "gemini:gemini-3.5-flash-lite",
          kind: "first",
          inputTokens: 1200,
          outputTokens: 400,
          latencyMs: 900,
          valid: true,
        },
      ],
    },
  },
];

const context = (taskId: number, iteration: number) => ({
  taskId,
  iteration,
  sha: sha(1),
  files: [{ path: "src/app/clientes/page.tsx", role: "target" }],
  trimmed: [],
  newFiles: [],
});

async function insertTasks(
  d: Db,
  runId: number,
  over: Partial<typeof tasks.$inferInsert>[],
) {
  return d
    .insert(tasks)
    .values(TASKS.map((t, i) => ({ ...t, runId, planRevision: 1, ...over[i] })))
    .returning();
}

async function awaitingPlan(d: Db) {
  const id = RUN_IDS.awaiting_plan_approval;
  await d.insert(runs).values({
    id,
    request: REQUEST,
    provider: "mock",
    providers: PROVIDERS,
    status: "awaiting_plan_approval",
    version: 3,
    planSummary:
      "Dos tareas: el campo de tipo con su migración y el filtro de la lista.",
    planAssumptions: [
      "El tipo por defecto de los clientes existentes es Particular.",
    ],
    baseSha: sha(1),
    contextPaths: ["src/db/schema.ts", "src/app/clientes/page.tsx"],
    statusChangedAt: minutesAgo(2),
  });
  await insertTasks(d, id, [{}, {}]);
  await d.insert(agentSteps).values({
    runId: id,
    iteration: 1,
    agent: "orchestrator",
    output: {},
    model: "gemini:gemini-3.8-flash",
  });
  await events(d, id, planEvents(id));
}

async function awaitingFinal(d: Db) {
  const id = RUN_IDS.awaiting_final_approval;
  const head = sha(111);
  await d.insert(runs).values({
    id,
    request: REQUEST,
    provider: "mock",
    providers: PROVIDERS,
    status: "awaiting_final_approval",
    version: 14,
    planSummary:
      "Dos tareas: el campo de tipo con su migración y el filtro de la lista.",
    baseSha: sha(1),
    headSha: head,
    prNumber: 99,
    prUrl: "https://github.com/daboy-dev/crm-demo/pull/99",
    llmCalls: 6,
    statusChangedAt: minutesAgo(1),
  });
  const [t1, t2] = await insertTasks(d, id, [
    { status: "passed", iteration: 1, commitSha: sha(1001) },
    { status: "passed", iteration: 2, commitSha: sha(1002) },
  ]);
  await d.insert(previews).values({
    sha: head,
    prNumber: 99,
    branch: `run/${id}`,
    prState: "open",
    previewUrl: "https://crm-demo.vercel.app",
    deployState: "success",
  });
  const result = (
    run: number,
    key: string,
    project: string,
  ): CriterionResult => ({
    key,
    run,
    revision: 1,
    criterion: key.split("-")[1]!,
    project,
    passed: true,
    error: null,
    failedStep: null,
    snapshot: null,
  });
  const projects = ["desktop", "mobile-390"];
  await d.insert(testReports).values({
    sha: head,
    runId: 1,
    runAttempt: 1,
    runUrl: "https://github.com/daboy-dev/crm-demo/actions",
    conclusion: "success",
    status: "passed",
    passed: 14,
    criteria: [
      ...projects.flatMap((p) => [
        result(id, "r1-c1", p),
        result(id, "r1-c2", p),
      ]),
      ...projects.map((p) => result(24, "r1-c1", p)),
    ],
    completedAt: minutesAgo(1),
  });
  await d.insert(agentSteps).values([
    {
      runId: id,
      iteration: 1,
      agent: "orchestrator",
      output: {},
      model: "gemini:gemini-3.8-flash",
      createdAt: minutesAgo(20),
    },
    {
      runId: id,
      iteration: 1,
      agent: "testing",
      scope: "steps",
      output: STEPS,
      model: "groq:openai/gpt-oss-120b",
      createdAt: minutesAgo(19),
    },
    {
      runId: id,
      taskId: t1!.id,
      iteration: 1,
      agent: "develop",
      output: {},
      model: "gemini:gemini-3.8-flash",
      createdAt: minutesAgo(18),
    },
    {
      runId: id,
      taskId: t2!.id,
      iteration: 1,
      agent: "develop",
      output: {},
      model: "gemini:gemini-3.8-flash",
      createdAt: minutesAgo(17),
    },
    {
      runId: id,
      taskId: t2!.id,
      iteration: 2,
      agent: "develop",
      output: {},
      model: "anthropic:claude-sonnet-5-5",
      createdAt: minutesAgo(8),
    },
  ]);
  const commit = (
    taskId: number,
    iteration: number,
    outside: string[] = [],
  ) => ({
    actor: "develop",
    kind: "commit",
    message: `Tarea ${taskId === t1!.id ? 1 : 2}, iteración ${iteration}: commit`,
    data: {
      taskId,
      iteration,
      files: ["src/app/clientes/page.tsx", ...outside],
      outsidePlan: outside,
    },
  });
  await events(d, id, [
    ...planEvents(id),
    { actor: "human", kind: "approved", message: "Plan aprobado." },
    {
      actor: "testing",
      kind: "steps",
      message: "Revisión 1: pasos de 2 criterios.",
    },
    {
      actor: "develop",
      kind: "context",
      message: "Tarea 1: lee 4 archivos",
      data: context(t1!.id, 1),
    },
    {
      actor: "system",
      kind: "overloaded",
      message: "Gemini saturado: el paso se reanuda en 30 s.",
    },
    {
      actor: "system",
      kind: "overloaded",
      message: "Gemini saturado: el paso se reanuda en 30 s.",
    },
    {
      actor: "system",
      kind: "overloaded",
      message: "Gemini saturado: el paso se reanuda en 30 s.",
    },
    {
      actor: "develop",
      kind: "context",
      message: "Tarea 2: lee 3 archivos",
      data: context(t2!.id, 1),
    },
    commit(t1!.id, 1, ["src/lib/client-types.ts"]),
    commit(t2!.id, 1),
    {
      actor: "system",
      kind: "pushed",
      message: `Rama run/${id} · PR #99. Esperando la comprobación del PR.`,
    },
    { actor: "system", kind: "check_passed", message: "pr-check en verde." },
    { actor: "github", kind: "report", message: "Informe E2E recibido." },
    {
      actor: "system",
      kind: "report",
      message: "Criterios: 1 pasan, 1 fallan.",
    },
    {
      actor: "testing",
      kind: "explain",
      message: "Testing explica 1 criterio que falla.",
      data: {
        criteria: [
          {
            key: "r1-c2",
            task: 2,
            verdict: "fail",
            reason: "Falta el filtro a 390 px.",
            evidence: 'select client-type-filter = "empresa"',
          },
        ],
        regressions: [],
      },
    },
    {
      actor: "develop",
      kind: "context",
      message: "Tarea 2: lee 3 archivos",
      data: context(t2!.id, 2),
    },
    commit(t2!.id, 2),
    { actor: "system", kind: "check_passed", message: "pr-check en verde." },
    { actor: "github", kind: "report", message: "Informe E2E recibido." },
    {
      actor: "system",
      kind: "report",
      message: "Criterios: 2 pasan, 0 fallan.",
    },
  ]);
}

async function blocked(d: Db) {
  const id = RUN_IDS.blocked;
  await d.insert(runs).values({
    id,
    request: REQUEST,
    provider: "mock",
    providers: PROVIDERS,
    status: "blocked",
    version: 20,
    blockedFrom: "developing",
    blockedReason: "La tarea 2 ha agotado sus 3 iteraciones.",
    baseSha: sha(1),
    headSha: sha(112),
    statusChangedAt: minutesAgo(3),
  });
  const [, t2] = await insertTasks(d, id, [
    { status: "passed", iteration: 1, commitSha: sha(1001) },
    {
      status: "blocked",
      iteration: 3,
      lastFeedback:
        "Criterios que fallan en la vista previa:\n- c2: el filtro no filtra.",
    },
  ]);
  await events(d, id, [
    ...planEvents(id),
    { actor: "human", kind: "approved", message: "Plan aprobado." },
    {
      actor: "develop",
      kind: "context",
      message: "Tarea 2: lee 3 archivos",
      data: context(t2!.id, 3),
    },
    {
      actor: "system",
      kind: "blocked",
      message: "La tarea 2 ha agotado sus 3 iteraciones.",
    },
  ]);
}

/** Leaves the E2E branch with the finished and queued runs plus `state`. */
export async function seed(state: ActiveState): Promise<number> {
  const d = db();
  await reset(d);
  await finishedAndQueued(d);
  switch (state) {
    case "awaiting_plan_approval":
      await awaitingPlan(d);
      break;
    case "awaiting_final_approval":
      await awaitingFinal(d);
      break;
    case "blocked":
      await blocked(d);
      break;
  }
  // RUNS_PER_DAY (D10): only the two queued runs count as created today.
  await d.execute(
    sql`update ${runs} set created_at = case when status = 'queued' then now() else now() - interval '2 days' end`,
  );
  return RUN_IDS[state];
}
