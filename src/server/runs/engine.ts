import { and, asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  runDevelop,
  runOrchestrator,
  runSplit,
  runTestingExplain,
  runTestingSteps,
} from "@/server/agents";
import { CONTEXT_FILES, readPlanContext } from "@/server/agents/context";
import { readDevelopContext } from "@/server/agents/develop-context";
import {
  developOutputSchema,
  explainSchemaLoose,
  MAX_TASKS_AFTER_SPLIT,
  planSchema,
  splitBaseSchema,
  stepsSchema,
  type AgentName,
  type CriteriaSteps,
  type DevelopOutput,
  type ExplainInput,
  type PlanInput,
  type TaskBrief,
  type TestingExplanation,
} from "@/server/agents/contracts";
import { checkPaths, PAGES_FILE } from "@/server/agents/paths";
import { getDb, type Db } from "@/server/db/client";
import {
  agentSteps,
  prChecks,
  previews,
  runEvents,
  runs,
  tasks,
  testReports,
} from "@/server/db/schema";
import { checkFeedback } from "@/server/pipeline/checks";
import { runBranch } from "@/server/github/config";
import {
  closePr,
  createBranch,
  createCommit,
  createPr,
  createTree,
  deleteBranch,
  findOpenPr,
  getBaseSha,
  getBranchSha,
  getCommitParents,
  getCommitTree,
  getFileText,
  getPr,
  mergePr,
  moveBranch,
} from "@/server/github/repo";
import { getProvider, runProviders } from "@/server/llm";
import { AGENT_SETTINGS, leaseSecondsFor } from "@/server/llm/chain";
import {
  InvalidOutput,
  OutputTruncated,
  Overloaded,
  QuotaExhausted,
  RateLimited,
  type CallHooks,
  type Generated,
  type LLMProvider,
} from "@/server/llm/provider";
import {
  cachedCall as cachedStep,
  CallLimitReached,
  totals,
  type CachedResult,
  type StepKey,
  type StepStore,
} from "./cache";
import { prepareCommits } from "./commits";
import {
  buildCriteriaFile,
  criteriaPath,
  criterionKey,
  feedbackFor,
  isSplitRevision,
  judge,
  pageNames,
  type CurrentCriterion,
} from "./criteria";
import { llmCallsPerRun } from "./limits";
import { sameContext } from "./timeline";
import {
  AWAITING_HUMAN,
  FINAL_STATUSES,
  isFinal,
  isStep,
  type Effect,
  type RunEvent,
  type RunStatus,
  type Verdict,
} from "./machine";
import {
  acquireLease,
  appendEvent,
  checkpoint,
  commitTransition,
  LeaseLost,
  loadRun,
  type Committed,
  type EventDraft,
  type LoadedRun,
  type RunSet,
  type TaskRow,
} from "./store";

/** A step that fails this many times in a row fails the run. */
const MAX_STEP_ATTEMPTS = 3;
/** A step state without a lease for this long is considered dropped. */
const STEP_GRACE_SECONDS = 30;
const PREVIEW_TIMEOUT_MINUTES = 15;
/** pr-check takes a minute or two (D33). */
const CHECK_TIMEOUT_MINUTES = 15;
/**
 * A failed deployment only counts as a broken build if no success replaces
 * it in this time: Vercel fails the first deployment of a new branch and
 * then succeeds on the same deployment (seen in H3).
 */
const BUILD_FAILURE_GRACE_SECONDS = 180;
const APPROVAL_TIMEOUT_HOURS = 24;

class BlockRun extends Error {}

/** The step made its LLM call and leaves the rest to another call (D35). */
type StepResult = Committed | { resume: true };

/** What a Vercel function may use of its 300 s, with a margin. */
const INVOCATION_BUDGET_MS = 280_000;
class SimulatedCrash extends Error {}

/** A busy model is tried again after this, without spending an attempt. */
const OVERLOAD_RETRY_SECONDS = 90;
/** Busy for this long in the same status: the human decides (blocked). */
const OVERLOAD_BLOCK_MINUTES = 30;

/** Margin on the retry delay of a 429 before the sweep resumes the step. */
const RATE_LIMIT_MARGIN_MS = 2_000;

type StepContext = {
  db: Db;
  run: LoadedRun;
  token: string;
  llm: (agent: AgentName) => Promise<LLMProvider>;
};

const short = (sha: string) => sha.slice(0, 7);

const brief = (t: TaskRow): TaskBrief => ({
  position: t.position,
  title: t.title,
  description: t.description,
  files: t.files,
  references: t.references,
  acceptanceCriteria: t.acceptanceCriteria,
});

/** agent_steps and runs.llm_calls of the run, under the step's lease. */
function stepStore(ctx: StepContext): StepStore {
  const { db, run, token } = ctx;
  const where = (key: StepKey) =>
    and(
      eq(agentSteps.runId, run.id),
      key.taskId === null
        ? isNull(agentSteps.taskId)
        : eq(agentSteps.taskId, key.taskId),
      eq(agentSteps.iteration, key.iteration),
      eq(agentSteps.agent, key.agent),
      eq(agentSteps.scope, key.scope ?? ""),
    );
  return {
    async find(key) {
      const [row] = await db
        .select({ output: agentSteps.output, calls: agentSteps.calls })
        .from(agentSteps)
        .where(where(key));
      return row ?? null;
    },
    async insert(key, output, calls) {
      const [row] = await db
        .insert(agentSteps)
        .values({
          runId: run.id,
          ...key,
          scope: key.scope ?? "",
          output,
          calls,
          ...totals(calls),
        })
        .onConflictDoNothing()
        .returning({ id: agentSteps.id });
      return Boolean(row);
    },
    async countCall() {
      const [row] = await db
        .update(runs)
        .set({ llmCalls: sql`${runs.llmCalls} + 1` })
        .where(eq(runs.id, run.id))
        .returning({ llmCalls: runs.llmCalls });
      run.llmCalls = row?.llmCalls ?? run.llmCalls + 1;
      return run.llmCalls;
    },
    async renewLease(seconds) {
      const [row] = await db
        .update(runs)
        .set({
          leaseUntil: sql`now() + make_interval(secs => ${seconds})`,
        })
        .where(and(eq(runs.id, run.id), eq(runs.leaseToken, token)))
        .returning({ id: runs.id });
      if (!row) throw new LeaseLost(run.id);
    },
  };
}

/**
 * Returns the stored output of an LLM step, or makes the call and stores it
 * (D22). A retried step never calls the LLM twice for the same key.
 */
function cachedCall<T>(
  ctx: StepContext,
  key: StepKey,
  schema: z.ZodType<T>,
  call: (hooks: CallHooks) => Promise<Generated<T>>,
): Promise<CachedResult<T>> {
  return cachedStep({
    store: stepStore(ctx),
    key,
    schema,
    used: ctx.run.llmCalls,
    limit: llmCallsPerRun(),
    call,
  });
}

/** Timeline data of an LLM step: model, tokens and latency (D26). */
const callData = (r: CachedResult<unknown>) => ({
  calls: r.calls,
  cached: r.cached,
});

// --- Steps ---

/** Previous revision of the plan, for a replan (D29). */
async function previousPlan(
  db: Db,
  run: LoadedRun,
): Promise<PlanInput["previous"]> {
  if (run.planRevision <= 1 || !run.planSummary) return null;
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.runId, run.id),
        eq(tasks.planRevision, run.planRevision - 1),
      ),
    )
    .orderBy(asc(tasks.position));
  return {
    summary: run.planSummary,
    tasks: rows.map((t) => ({
      position: t.position,
      title: t.title,
      status: t.status,
      lastFeedback: t.lastFeedback,
      acceptanceCriteria: t.acceptanceCriteria,
    })),
  };
}

async function stepPlanning(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  if (run.splitTaskId !== null) return stepSplit(ctx);

  // D27: every revision plans on the master sha read when the run started,
  // which is also the base of run/<id>.
  let baseSha = run.baseSha;
  if (!baseSha) {
    baseSha = await getBaseSha();
    await checkpoint(db, run, token, { baseSha });
    run.baseSha = baseSha;
  }
  const base = baseSha;
  // Code on the branch: only new or corrective tasks (D29).
  const mode = run.headSha ? "amend" : "replace";
  let contextPaths = run.contextPaths;

  const result = await cachedCall(
    ctx,
    { agent: "orchestrator", taskId: null, iteration: run.planRevision },
    planSchema,
    async (hooks) => {
      const context = await readPlanContext(base);
      contextPaths = context.files.map((f) => f.path);
      await checkpoint(db, run, token, { contextPaths });
      return runOrchestrator(
        await ctx.llm("orchestrator"),
        {
          runId: run.id,
          request: run.request,
          planRevision: run.planRevision,
          mode,
          feedback: run.feedback,
          previous: await previousPlan(db, run),
          context,
        },
        hooks,
      );
    },
  );
  const plan = result.output;

  if (run.simulatePlanCrash && !run.planCrashedAt) {
    await checkpoint(db, run, token, { planCrashedAt: new Date() });
    throw new SimulatedCrash(
      "Caída simulada justo después de guardar el plan. El sweep reanudará el paso cuando caduque el lease, sin volver a llamar al LLM.",
    );
  }

  const set = {
    planSummary: plan.summary,
    planAssumptions: plan.assumptions,
    // Set by the call, or by the attempt that stored the plan first.
    contextPaths: contextPaths ?? CONTEXT_FILES,
  };

  if (!plan.feasible) {
    const reason = plan.rejectionReason ?? plan.summary;
    return commitTransition(
      db,
      run,
      { type: "plan_infeasible", reason },
      {
        leaseToken: token,
        set: { ...set, rejectedReason: reason },
        events: [
          {
            actor: "orchestrator",
            kind: "infeasible",
            message: `Petición fuera de alcance: ${reason}`,
            data: { plan, ...callData(result) },
          },
        ],
      },
    );
  }

  await db
    .insert(tasks)
    .values(
      plan.tasks.map((t, i) => ({
        runId: run.id,
        planRevision: run.planRevision,
        position: i + 1,
        title: t.title,
        description: t.description,
        files: t.files,
        references: t.references,
        acceptanceCriteria: t.acceptanceCriteria,
      })),
    )
    .onConflictDoNothing();
  const withTasks = (await loadRun(db, run.id))!;
  const kind = mode === "amend" ? "tareas nuevas" : "tareas";
  return commitTransition(
    db,
    withTasks,
    { type: "plan_ready" },
    {
      leaseToken: token,
      set,
      events: [
        {
          actor: "orchestrator",
          kind: "plan",
          message: `Plan (revisión ${run.planRevision}) con ${plan.tasks.length} ${kind}: ${plan.summary}`,
          data: { plan, mode, ...callData(result) },
        },
      ],
    },
  );
}

type DevelopResult = {
  task: TaskRow;
  output: DevelopOutput;
  calls: ReturnType<typeof callData>;
};

/**
 * Splits the task whose Develop answer did not fit (D34, extra of D29). The
 * new revision keeps every other task as it was, with its stored outputs,
 * and puts the subtasks in the place of the original. No new approval: the
 * criteria are the same.
 */
async function stepSplit(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  const previous = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.runId, run.id),
        eq(tasks.planRevision, run.planRevision - 1),
      ),
    )
    .orderBy(asc(tasks.position));
  const original = previous.find((t) => t.id === run.splitTaskId);
  if (!original)
    throw new Error(`No está la tarea ${run.splitTaskId} que dividir`);
  // Tasks split in an older revision were not carried over.
  const others = previous.filter((t) => t.id !== original.id);
  const maxTasks = Math.min(3, MAX_TASKS_AFTER_SPLIT - others.length);
  if (maxTasks < 2) {
    throw new BlockRun(
      `El plan ya tiene ${previous.length} tareas: no se puede dividir`,
    );
  }

  // The subtasks may build on what earlier tasks already committed.
  const readSha = run.headSha ?? run.baseSha ?? (await getBaseSha());
  const result = await cachedCall(
    ctx,
    { agent: "orchestrator", taskId: null, iteration: run.planRevision },
    splitBaseSchema,
    async (hooks) =>
      runSplit(
        await ctx.llm("orchestrator"),
        {
          runId: run.id,
          request: run.request,
          mode: "split",
          planRevision: run.planRevision,
          task: brief(original),
          reason: run.splitReason ?? "La respuesta de Develop se ha cortado",
          others: others.map((t) => ({
            position: t.position,
            title: t.title,
            files: t.files,
          })),
          maxTasks,
          context: await readPlanContext(readSha),
        },
        hooks,
      ),
  );
  const split = result.output;

  // The new revision, in order: the subtasks in the place of the original.
  const rows: (typeof tasks.$inferInsert & { from?: number })[] = [];
  for (const t of previous) {
    if (t.id === original.id) {
      for (const sub of split.tasks) {
        rows.push({
          runId: run.id,
          planRevision: run.planRevision,
          position: rows.length + 1,
          title: sub.title,
          description: sub.description,
          files: sub.files,
          references: sub.references,
          acceptanceCriteria: sub.acceptanceCriteria,
          status: "developing",
          iteration: 1,
          maxIterations: original.maxIterations,
          splitFrom: original.id,
        });
      }
    } else {
      rows.push({
        runId: run.id,
        planRevision: run.planRevision,
        position: rows.length + 1,
        title: t.title,
        description: t.description,
        files: t.files,
        references: t.references,
        acceptanceCriteria: t.acceptanceCriteria,
        status: t.status,
        iteration: t.iteration,
        maxIterations: t.maxIterations,
        lastFeedback: t.lastFeedback,
        commitSha: t.commitSha,
        splitFrom: t.splitFrom,
        from: t.id,
      });
    }
  }
  await db
    .insert(tasks)
    .values(rows.map(({ from: _from, ...row }) => (void _from, row)))
    .onConflictDoNothing();

  // Tasks already developed keep their outputs: no second call (D34).
  const inserted = await db
    .select({ id: tasks.id, position: tasks.position })
    .from(tasks)
    .where(
      and(eq(tasks.runId, run.id), eq(tasks.planRevision, run.planRevision)),
    );
  for (const row of rows) {
    const to = inserted.find((t) => t.position === row.position)?.id;
    if (!row.from || !to) continue;
    await db.execute(sql`
      insert into agent_steps (run_id, task_id, iteration, agent, output, model, input_tokens, output_tokens, latency_ms, calls)
      select run_id, ${to}, iteration, agent, output, model, input_tokens, output_tokens, latency_ms, calls
      from agent_steps where run_id = ${run.id} and task_id = ${row.from}
      on conflict do nothing`);
  }

  const withTasks = (await loadRun(db, run.id))!;
  return commitTransition(
    db,
    withTasks,
    { type: "split_ready" },
    {
      leaseToken: token,
      set: { splitTaskId: null, splitReason: null },
      events: [
        {
          actor: "orchestrator",
          kind: "split",
          message: `Tarea ${original.position} dividida en ${split.tasks.length} subtareas con los mismos criterios (revisión ${run.planRevision}), sin nueva aprobación: ${split.reason}`,
          data: { split, from: original.id, ...callData(result) },
        },
      ],
    },
  );
}

/** Whether Testing has already judged a preview of the run. */
async function previewJudged(db: Db, runId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: runEvents.id })
    .from(runEvents)
    .where(
      and(
        eq(runEvents.runId, runId),
        eq(runEvents.actor, "system"),
        eq(runEvents.kind, "report"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

// --- Testing's steps (D38) ---

const STEPS_SCOPE = "steps";
/** Specs Testing reads as an example of the flows and the data-testid. */
const EXAMPLE_SPECS = ["e2e/write-flow.spec.ts"];

const allTasks = (db: Db, runId: number) =>
  db.select().from(tasks).where(eq(tasks.runId, runId));

/** Stored steps of every revision of the run, by revision. */
async function storedSteps(
  db: Db,
  runId: number,
): Promise<Map<number, CriteriaSteps>> {
  const rows = await db
    .select({ iteration: agentSteps.iteration, output: agentSteps.output })
    .from(agentSteps)
    .where(
      and(
        eq(agentSteps.runId, runId),
        isNull(agentSteps.taskId),
        eq(agentSteps.agent, "testing"),
        eq(agentSteps.scope, STEPS_SCOPE),
      ),
    );
  return new Map(rows.map((r) => [r.iteration, stepsSchema.parse(r.output)]));
}

/**
 * Testing writes the steps of the revision's criteria once, right after the
 * approval and before Develop (D38). An amend only has its new criteria; a
 * split keeps the criteria, so it reuses the steps of the split revision.
 * Returns whether it called the LLM: then the step resumes (D35).
 */
async function ensureSteps(
  ctx: StepContext,
  readSha: string,
): Promise<{ called: boolean }> {
  const { db, run } = ctx;
  const revision = run.planRevision;
  const key: StepKey = {
    agent: "testing",
    taskId: null,
    iteration: revision,
    scope: STEPS_SCOPE,
  };
  const store = stepStore(ctx);
  if (await store.find(key)) return { called: false };

  if (isSplitRevision(await allTasks(db, run.id), revision)) {
    const previous = await store.find({ ...key, iteration: revision - 1 });
    if (previous) {
      await store.insert(key, previous.output, []);
      await appendEvent(db, run, {
        actor: "testing",
        kind: "steps",
        message: `Revisión ${revision}: la división mantiene los criterios, así que reutiliza sus pasos sin llamar al LLM.`,
      });
      return { called: false };
    }
  }

  const criteria = run.tasks.flatMap((t) =>
    t.acceptanceCriteria
      .filter((c) => c.type === "e2e")
      .map((c) => ({
        id: c.id,
        task: t.position,
        text: c.text,
        testIds: c.testIds,
      })),
  );
  if (criteria.length === 0) return { called: false };
  const result = await cachedCall(ctx, key, stepsSchema, async (hooks) => {
    const [pages, ...examples] = await Promise.all(
      [PAGES_FILE, ...EXAMPLE_SPECS].map((f) => getFileText(f, readSha)),
    );
    return runTestingSteps(
      await ctx.llm("testing"),
      {
        runId: run.id,
        request: run.request,
        planRevision: revision,
        tasks: run.tasks.map((t) => ({
          position: t.position,
          title: t.title,
          description: t.description,
        })),
        criteria,
        pages: pageNames(pages ?? null),
        examples: EXAMPLE_SPECS.flatMap((path, i) => {
          const content = examples[i];
          return content ? [{ path, content }] : [];
        }),
      },
      hooks,
    );
  });
  await appendEvent(db, run, {
    actor: "testing",
    kind: "steps",
    message: `Revisión ${revision}: pasos de ${result.output.criteria.length} criterios para ${criteriaPath(run.id)}.`,
    data: { revision, steps: result.output, ...callData(result) },
  });
  return { called: !result.cached };
}

/** Data of the last context logged for a task and iteration (D44). */
async function lastContext(
  db: Db,
  runId: number,
  task: { id: number; iteration: number },
): Promise<unknown> {
  const [row] = await db
    .select({ data: runEvents.data })
    .from(runEvents)
    .where(
      and(
        eq(runEvents.runId, runId),
        eq(runEvents.kind, "context"),
        sql`(${runEvents.data}->>'taskId')::int = ${task.id}`,
        sql`(${runEvents.data}->>'iteration')::int = ${task.iteration}`,
      ),
    )
    .orderBy(desc(runEvents.id))
    .limit(1);
  return row?.data ?? null;
}

async function stepDeveloping(ctx: StepContext): Promise<StepResult> {
  const { db, run, token } = ctx;
  const branch = runBranch(run.id);
  const work = run.tasks.filter((t) => t.status === "developing");
  if (work.length === 0) throw new Error("No hay tareas en desarrollo");

  // D32: read at the head of run/<id> (the base before the first push).
  const readSha = run.headSha ?? run.baseSha ?? (await getBaseSha());
  // D38: before the first Develop call of the revision; its own invocation.
  if ((await ensureSteps(ctx, readSha)).called) return { resume: true };
  const store = stepStore(ctx);
  const outputs: DevelopResult[] = [];
  let called = false;
  for (const task of work) {
    const key = {
      agent: "develop" as const,
      taskId: task.id,
      iteration: task.iteration,
    };
    // D35: one LLM call per invocation; the next one gets its own 300 s.
    if (called && !(await store.find(key))) return { resume: true };

    let result: CachedResult<DevelopOutput>;
    try {
      result = await cachedCall(
        ctx,
        key,
        developOutputSchema,
        async (hooks) => {
          const context = await readDevelopContext({
            sha: readSha,
            task: brief(task),
            // Earlier tasks of this step are not committed yet.
            overlay: outputs.flatMap((o) => o.output.files),
          });
          const data = {
            taskId: task.id,
            iteration: task.iteration,
            sha: context.sha,
            files: context.files.map((f) => ({ path: f.path, role: f.role })),
            trimmed: context.trimmed,
            newFiles: context.newFiles,
          };
          // D44: a resumed step (saturation, lease) reads the same files.
          if (!sameContext(await lastContext(db, run.id, task), data)) {
            await appendEvent(db, run, {
              actor: "develop",
              kind: "context",
              message: `Tarea ${task.position}: lee ${context.files.length} archivos${context.trimmed.length ? ` (${context.trimmed.length} recortados por tamaño)` : ""}`,
              data,
            });
          }
          if (run.simulateMaxTokens && !run.maxTokensSimulatedAt) {
            // H5: the first call answers as cut, without spending a request.
            run.maxTokensSimulatedAt = new Date();
            await checkpoint(db, run, token, {
              maxTokensSimulatedAt: run.maxTokensSimulatedAt,
            });
            throw new OutputTruncated(
              "simulación",
              AGENT_SETTINGS.develop.maxOutputTokens,
              [],
            );
          }
          return runDevelop(
            await ctx.llm("develop"),
            {
              runId: run.id,
              request: run.request,
              task: brief(task),
              iteration: task.iteration,
              feedback: task.lastFeedback,
              context,
            },
            hooks,
          );
        },
      );
    } catch (error) {
      if (error instanceof OutputTruncated) {
        return taskTooLarge(ctx, task, error);
      }
      throw error;
    }
    if (!result.cached) called = true;

    const output = result.output;
    // D16: checked where the commits are made, before anything is written.
    const check = checkPaths(output.files.map((f) => f.path));
    if (!check.ok) {
      return commitTransition(
        db,
        run,
        { type: "forbidden", taskId: task.id, reason: check.reason },
        {
          leaseToken: token,
          events: [
            {
              actor: "develop",
              kind: "forbidden",
              message: `Tarea ${task.position}: cambio rechazado. ${check.reason}`,
              data: { files: output.files.map((f) => f.path) },
            },
          ],
        },
      );
    }
    outputs.push({ task, output, calls: callData(result) });
  }

  // 1. Build the commit chain once and remember it before touching the ref.
  let targetSha = run.targetSha;
  let commits = run.targetCommits ?? {};
  let unchanged: DevelopResult[] = [];
  const notes: EventDraft[] = [];
  if (!targetSha) {
    const current = await getBranchSha(branch);
    if (current !== run.headSha) {
      throw new BlockRun(
        `La rama ${branch} no está en el commit esperado (${current ? short(current) : "no existe"})`,
      );
    }
    // D40: the single failure lasts until Testing has judged a preview: an
    // iteration that pr-check sends back never reaches it (run #22).
    const breakOnce =
      run.simulateCriterionFail && !(await previewJudged(db, run.id));
    const prepared = await prepareCommits(
      outputs,
      (path) => getFileText(path, readSha),
      {
        simulateTypeError: run.simulateTypeError,
        breakTestIds: ({ task }) =>
          run.simulatePersistentFail || breakOnce
            ? task.acceptanceCriteria.flatMap((c) => c.testIds)
            : [],
      },
    );
    unchanged = prepared.unchanged;
    notes.push(...prepared.notes);
    if (prepared.changed.length === 0) {
      return commitTransition(
        db,
        run,
        { type: "develop_unchanged" },
        {
          leaseToken: token,
          events: [
            ...notes,
            {
              actor: "develop",
              kind: "unchanged",
              // D40: renaming the data-testid back can undo Develop's fix.
              message: prepared.notes.some((n) => n.kind === "simulation")
                ? "Tras la simulación, los archivos quedan como ya estaban en la rama: la iteración cuenta como fallida."
                : "Develop no ha cambiado ningún archivo: la iteración cuenta como fallida.",
            },
          ],
        },
      );
    }
    // The first commit sits on the sha the orchestrator read (D27).
    let parent = readSha;
    let tree = await getCommitTree(parent);
    commits = {};
    for (const { task, output, files } of prepared.changed) {
      tree = await createTree(tree, files);
      parent = await createCommit({
        message: output.commitMessage,
        tree,
        parent,
      });
      commits[String(task.id)] = parent;
    }
    // D38: the criteria JSON rides on the same push, so no extra build.
    const file = buildCriteriaFile(
      run.id,
      await allTasks(db, run.id),
      await storedSteps(db, run.id),
    );
    const path = criteriaPath(run.id);
    if (
      JSON.parse(file).criteria.length > 0 &&
      (await getFileText(path, readSha)) !== file
    ) {
      tree = await createTree(tree, [{ path, content: file }]);
      parent = await createCommit({
        message: `test(e2e): add acceptance criteria of run #${run.id}`,
        tree,
        parent,
      });
      notes.push({
        actor: "testing",
        kind: "criteria",
        message: `${path} entra en la cadena de commits (${short(parent)}).`,
      });
    }
    targetSha = parent;
    await checkpoint(db, run, token, { targetSha, targetCommits: commits });
  } else {
    unchanged = outputs.filter((o) => !commits[String(o.task.id)]);
  }

  // 2. Point the branch at the chain: a single push, so a single build (D20).
  const current = await getBranchSha(branch);
  if (current !== targetSha) {
    if (current !== run.headSha) {
      throw new BlockRun(`La rama ${branch} se ha movido fuera del panel`);
    }
    if (current === null) await createBranch(branch, targetSha);
    else await moveBranch(branch, targetSha);
  }

  if (run.simulateCrash && !run.crashedAt) {
    await checkpoint(db, run, token, { crashedAt: new Date() });
    throw new SimulatedCrash(
      "Caída simulada justo después de mover la rama. El sweep reanudará el paso cuando caduque el lease.",
    );
  }

  // 3. One PR per run: reuse the open one (D22).
  let prNumber = run.prNumber;
  let prUrl = run.prUrl;
  if (!prNumber) {
    const pr =
      (await findOpenPr(branch)) ??
      (await createPr({
        branch,
        title: `Run #${run.id}: ${run.request.slice(0, 80)}`,
        body: `Petición: ${run.request}\n\nPR creado por el panel crm-agents (run #${run.id}).`,
      }));
    prNumber = pr.number;
    prUrl = pr.url;
  }

  const committed = outputs.filter((o) => commits[String(o.task.id)]);
  return commitTransition(
    db,
    run,
    { type: "develop_done" },
    {
      leaseToken: token,
      set: {
        headSha: targetSha,
        targetSha: null,
        targetCommits: null,
        prNumber,
        prUrl,
      },
      taskSet: Object.fromEntries(
        committed.map(({ task }) => [
          task.id,
          { commitSha: commits[String(task.id)] ?? null },
        ]),
      ),
      events: [
        ...notes,
        ...committed.map(({ task, output, calls }) => ({
          actor: "develop" as const,
          kind: "commit",
          message: `Tarea ${task.position}, iteración ${task.iteration}: commit ${short(commits[String(task.id)] ?? "")} · ${output.commitMessage}`,
          data: {
            taskId: task.id,
            iteration: task.iteration,
            files: output.files.map((f) => f.path),
            outsidePlan: output.files
              .map((f) => f.path)
              .filter((p) => !task.files.includes(p)),
            notes: output.notes,
            evidence: output.evidence ?? [],
            ...calls,
          },
        })),
        ...unchanged.map(({ task, calls }) => ({
          actor: "develop" as const,
          kind: "unchanged",
          message: `Tarea ${task.position}, iteración ${task.iteration}: Develop no ha cambiado nada; sin commit.`,
          data: calls,
        })),
        {
          actor: "system",
          kind: "pushed",
          message: `Rama ${branch} en ${short(targetSha)} · PR #${prNumber}. Esperando la comprobación del PR.`,
        },
      ],
    },
  );
}

/**
 * Develop's answer was cut (D34): the orchestrator splits the task, unless
 * it is already a subtask or the plan has no room left.
 */
async function taskTooLarge(
  ctx: StepContext,
  task: TaskRow,
  error: OutputTruncated,
): Promise<Committed> {
  const { db, run, token } = ctx;
  const live = run.tasks.filter((t) => t.status !== "split").length;
  const reason =
    task.splitFrom !== null
      ? `La tarea ${task.position} ya viene de una división y tampoco cabe en la respuesta: decide el humano.`
      : live + 1 > MAX_TASKS_AFTER_SPLIT
        ? `La tarea ${task.position} no cabe en la respuesta y el plan ya tiene ${live} tareas: no se puede dividir más.`
        : null;
  const calls = { calls: error.calls, cached: false };
  if (reason) {
    return commitTransition(
      db,
      run,
      { type: "block", reason },
      {
        leaseToken: token,
        events: [
          { actor: "develop", kind: "too_large", message: reason, data: calls },
        ],
      },
    );
  }
  return commitTransition(
    db,
    run,
    { type: "task_too_large", taskId: task.id, reason: error.message },
    {
      leaseToken: token,
      events: [
        {
          actor: "develop",
          kind: "too_large",
          message: `Tarea ${task.position}: ${error.message}. El Orquestador la divide en subtareas con los mismos criterios.`,
          data: calls,
        },
      ],
    },
  );
}

async function latestReport(db: Db, sha: string) {
  const [report] = await db
    .select()
    .from(testReports)
    .where(
      and(
        eq(testReports.sha, sha),
        notInArray(testReports.status, ["cancelled"]),
      ),
    )
    .orderBy(desc(testReports.completedAt), desc(testReports.runAttempt))
    .limit(1);
  return report ?? null;
}

/** The task the failing mock scenarios pick on (D24). */
const MOCK_TARGET_TASK = 2;

/**
 * Mock scenarios fail-once and blocked (D24): the mock's code never changes
 * the app, so the runner cannot fail it. The panel scripts the failure of the
 * target task's criteria instead, only when Testing is the mock.
 */
function scriptedFailures(run: LoadedRun, current: CurrentCriterion[]) {
  if (runProviders(run).testing !== "mock") return [];
  const target = run.tasks.find(
    (t) => t.position === MOCK_TARGET_TASK && t.status === "testing",
  );
  if (!target) return [];
  const fails =
    run.scenario === "blocked" ||
    (run.scenario === "fail-once" && target.iteration === 1);
  return fails ? current.filter((c) => c.taskId === target.id) : [];
}

async function stepTesting(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  if (!run.headSha) throw new Error("El run no tiene commit");
  const headSha = run.headSha;
  const report = await latestReport(db, headSha);
  if (!report) throw new Error(`No hay informe E2E para ${short(headSha)}`);

  // Criteria of this revision, by the key of the runner's titles.
  const current: CurrentCriterion[] = run.tasks.flatMap((t) =>
    t.acceptanceCriteria
      .filter((c) => c.type === "e2e")
      .map((c) => ({
        key: criterionKey(run.planRevision, c.id),
        taskId: t.id,
        task: t.position,
        text: c.text,
      })),
  );
  const judgement = judge(run.id, current, report.criteria, report.failures);
  for (const c of scriptedFailures(run, current)) {
    if (judgement.failed.some((f) => f.key === c.key)) continue;
    judgement.passed = judgement.passed.filter((k) => k !== c.key);
    judgement.failed.push({
      key: c.key,
      run: run.id,
      revision: run.planRevision,
      criterion: c.key.split("-")[1]!,
      project: "",
      passed: false,
      error: `Fallo simulado del escenario ${run.scenario} (MockProvider)`,
      failedStep: null,
      snapshot: null,
      taskId: c.taskId,
      task: c.task,
      text: c.text,
    });
  }

  const testing = run.tasks.filter((t) => t.status === "testing");
  const events: EventDraft[] = [
    {
      actor: "system",
      kind: "report",
      message: `Informe E2E de ${short(headSha)}: ${report.passed} pasan, ${report.failed} fallan. Criterios: ${judgement.passed.length} pasan, ${judgement.failed.length} fallan.`,
      data: {
        reportId: report.id,
        passed: judgement.passed,
        failed: judgement.failed.map((f) => ({
          key: f.key,
          task: f.task,
          project: f.project,
          error: f.error,
          failedStep: f.failedStep,
        })),
        regressions: judgement.regressions,
      },
    },
  ];

  // D39: everything passed, no LLM call.
  let explanation: TestingExplanation = { criteria: [], regressions: [] };
  if (judgement.failed.length > 0 || judgement.regressions.length > 0) {
    const input: ExplainInput = {
      runId: run.id,
      request: run.request,
      tasks: testing.map((t) => ({
        position: t.position,
        title: t.title,
        files: t.files,
      })),
      // A failing criterion of a task that already passed is a regression.
      failed: judgement.failed.filter((f) =>
        testing.some((t) => t.id === f.taskId),
      ),
      regressions: [
        ...judgement.regressions,
        ...judgement.failed
          .filter((f) => !testing.some((t) => t.id === f.taskId))
          .map((f) => ({
            title: `run-${run.id} r${f.revision} ${f.criterion} · ${f.text}`,
            project: f.project,
            error: f.error ?? "",
          })),
      ],
    };
    const result = await cachedCall(
      ctx,
      {
        agent: "testing",
        taskId: null,
        iteration: run.planRevision,
        scope: `explain:${headSha}`,
      },
      // Stored outputs were validated against this input when written.
      explainSchemaLoose,
      async (hooks) =>
        runTestingExplain(await ctx.llm("testing"), input, hooks),
    );
    explanation = result.output;
    events.push({
      actor: "testing",
      kind: "explain",
      message: `Testing explica ${explanation.criteria.length} criterios que fallan y ${explanation.regressions.length} regresiones.`,
      data: { ...explanation, ...callData(result) },
    });
  }

  const verdicts: Verdict[] = testing.map((task) => {
    const failed = judgement.failed
      .filter((f) => f.taskId === task.id)
      .map((f) => {
        const why = explanation.criteria.find((c) => c.key === f.key);
        return {
          key: f.key,
          criterion: f.criterion,
          reason: why?.reason ?? f.error ?? "El criterio falla.",
          evidence: why?.evidence ?? f.failedStep?.action ?? "",
          snapshot: f.snapshot,
          url: f.failedStep?.url,
        };
      });
    const regressions = explanation.regressions.filter(
      (r) => r.task === task.position,
    );
    const passed = failed.length === 0 && regressions.length === 0;
    return {
      taskId: task.id,
      passed,
      feedback: passed ? "" : feedbackFor(failed, regressions),
    };
  });
  for (const [i, task] of testing.entries()) {
    const v = verdicts[i]!;
    events.push({
      actor: "testing",
      kind: v.passed ? "passed" : "failed",
      message: `Tarea ${task.position}, iteración ${task.iteration}: ${v.passed ? "pasa" : "falla"}.${v.passed ? "" : ` ${v.feedback.split("\n").slice(0, 3).join(" ")}`}`,
      data: { taskId: task.id, iteration: task.iteration },
    });
  }
  return commitTransition(
    db,
    run,
    { type: "testing_done", verdicts },
    { leaseToken: token, events },
  );
}

async function stepMerging(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  if (!run.prNumber || !run.headSha) throw new Error("El run no tiene PR");
  const result = await mergePr(
    run.prNumber,
    run.headSha,
    `Run #${run.id}: ${run.request.slice(0, 60)} (#${run.prNumber})`,
  );
  if (result === "not_mergeable") {
    throw new BlockRun(`GitHub no deja fusionar el PR #${run.prNumber}`);
  }
  return commitTransition(
    db,
    run,
    { type: "merged" },
    {
      leaseToken: token,
      events: [
        {
          actor: "github",
          kind: "merged",
          message: `PR #${run.prNumber} fusionado en master (squash).`,
        },
      ],
    },
  );
}

const STEPS = {
  planning: stepPlanning,
  developing: stepDeveloping,
  testing: stepTesting,
  merging: stepMerging,
} as const;

/**
 * Runs the step of the run's current status under a lease. Safe to call at
 * any time and from anywhere: it does nothing when there is no step to run
 * or another process holds it.
 */
export async function runStep(
  runId: number,
  /** When the invocation started: it decides whether another call fits. */
  startedAt = Date.now(),
): Promise<void> {
  const db = getDb();
  const run = await loadRun(db, runId);
  if (!run || !isStep(run.status as RunStatus)) return;
  const token = await acquireLease(db, run);
  if (!token) return;
  const ctx: StepContext = {
    db,
    run,
    token,
    llm: (agent) => getProvider(runProviders(run)[agent], agent, run.scenario),
  };

  let outcome: StepResult;
  try {
    outcome = await STEPS[run.status as keyof typeof STEPS](ctx);
  } catch (error) {
    outcome = await stepFailed(ctx, error);
  }
  if ("resume" in outcome) {
    // D35: free the step for the next call. It runs here if a whole call
    // still fits in this invocation, or in the next sweep otherwise.
    await db
      .update(runs)
      .set({ leaseUntil: sql`now()`, leaseToken: null, stepAttempts: 0 })
      .where(and(eq(runs.id, run.id), eq(runs.leaseToken, token)));
    const next = Date.now() + leaseSecondsFor("develop") * 1000;
    if (next - startedAt < INVOCATION_BUDGET_MS)
      await runStep(runId, startedAt);
    return;
  }
  if (outcome.applied) await executeEffects(runId, outcome.effects);
}

async function stepFailed(
  ctx: StepContext,
  error: unknown,
): Promise<Committed> {
  const { db, run, token } = ctx;
  if (error instanceof LeaseLost) return { applied: false };
  if (error instanceof SimulatedCrash) {
    // Like a real crash: the lease stays until it expires and the sweep resumes.
    await appendEvent(db, run, {
      actor: "system",
      kind: "crash",
      message: error.message,
    });
    return { applied: false };
  }
  if (error instanceof RateLimited) {
    // D26: no waiting inside the function and not a failure of the step. The
    // lease is pushed to the retryDelay and the sweep resumes it then.
    const ms = error.retryAfterMs + RATE_LIMIT_MARGIN_MS;
    await db
      .update(runs)
      .set({
        leaseUntil: sql`now() + make_interval(secs => ${Math.ceil(ms / 1000)})`,
      })
      .where(and(eq(runs.id, run.id), eq(runs.leaseToken, token)));
    await appendEvent(db, run, {
      actor: "system",
      kind: "rate_limited",
      message: `${error.message}. El paso se reanuda solo.`,
      data: { model: error.model, retryAfterMs: error.retryAfterMs },
    });
    return { applied: false };
  }
  if (error instanceof Overloaded) {
    // Seen in H5: Gemini answered 503 on every model for minutes. Like the
    // per-minute 429, it postpones the step; after a while it blocks the run
    // instead of failing it, so the work done is kept.
    if (olderThan(run.statusChangedAt, OVERLOAD_BLOCK_MINUTES * 60)) {
      const reason = `${error.message}. Llevan más de ${OVERLOAD_BLOCK_MINUTES} minutos saturados: reintenta más tarde.`;
      return commitTransition(
        db,
        run,
        { type: "block", reason },
        {
          leaseToken: token,
          events: [{ actor: "system", kind: "blocked", message: reason }],
        },
      );
    }
    await db
      .update(runs)
      .set({
        leaseUntil: sql`now() + make_interval(secs => ${OVERLOAD_RETRY_SECONDS})`,
      })
      .where(and(eq(runs.id, run.id), eq(runs.leaseToken, token)));
    await appendEvent(db, run, {
      actor: "system",
      kind: "overloaded",
      message: `${error.message}: el paso se reanuda en ${OVERLOAD_RETRY_SECONDS} s, sin gastar intentos.`,
      data: { models: error.models },
    });
    return { applied: false };
  }
  if (
    error instanceof BlockRun ||
    error instanceof CallLimitReached ||
    error instanceof QuotaExhausted
  ) {
    return commitTransition(
      db,
      run,
      { type: "block", reason: error.message },
      {
        leaseToken: token,
        events: [{ actor: "system", kind: "blocked", message: error.message }],
      },
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`run ${run.id} step ${run.status} failed:`, message);
  const attempts = run.stepAttempts + 1;
  if (attempts >= MAX_STEP_ATTEMPTS) {
    return commitTransition(
      db,
      run,
      { type: "step_failed", reason: message },
      {
        leaseToken: token,
        events: [
          {
            actor: "system",
            kind: "failed",
            message: `El paso ${run.status} ha fallado ${attempts} veces: ${message.slice(0, 500)}`,
          },
        ],
      },
    );
  }
  // Keep the lease: the sweep retries once it expires, which spaces attempts.
  await db
    .update(runs)
    .set({ stepAttempts: attempts })
    .where(and(eq(runs.id, run.id), eq(runs.leaseToken, token)));
  await appendEvent(db, run, {
    actor: "system",
    kind: "error",
    message: `Error en el paso ${run.status} (intento ${attempts} de ${MAX_STEP_ATTEMPTS}): ${message.slice(0, 500)}`,
    // An answer that failed the contract still cost calls: show them.
    data:
      error instanceof InvalidOutput || error instanceof OutputTruncated
        ? { calls: error.calls }
        : undefined,
  });
  return { applied: false };
}

// --- Effects, queue and cleanup ---

export async function executeEffects(runId: number, effects: Effect[]) {
  for (const effect of effects) {
    switch (effect.type) {
      case "run_step":
        await runStep(runId);
        break;
      case "cleanup":
        await cleanup(runId);
        break;
      case "start_next":
        await startNext();
        break;
      case "check_preview": {
        const db = getDb();
        const [run] = await db.select().from(runs).where(eq(runs.id, runId));
        if (run) await checkPreview(db, run, { timeout: false });
        break;
      }
      case "check_pr": {
        const db = getDb();
        const [run] = await db.select().from(runs).where(eq(runs.id, runId));
        if (run) await checkPrCheck(db, run, { timeout: false });
        break;
      }
    }
  }
}

/** Closes the PR and deletes the branch of a run that ended without merge (D11). */
export async function cleanup(runId: number) {
  const db = getDb();
  const run = await loadRun(db, runId);
  if (!run || !run.cleanupPending) return;
  if (run.prNumber) {
    const pr = await getPr(run.prNumber);
    if (pr.state === "open") await closePr(run.prNumber);
  }
  await deleteBranch(runBranch(run.id));
  const [done] = await db
    .update(runs)
    .set({ cleanupPending: false })
    .where(and(eq(runs.id, run.id), eq(runs.cleanupPending, true)))
    .returning({ id: runs.id });
  if (done) {
    await appendEvent(db, run, {
      actor: "system",
      kind: "cleanup",
      message: run.prNumber
        ? `PR #${run.prNumber} cerrado y rama ${runBranch(run.id)} borrada.`
        : `Rama ${runBranch(run.id)} borrada.`,
    });
  }
}

/** Starts the oldest queued run if no run is active (D23). */
export async function startNext() {
  const db = getDb();
  const [active] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(notInArray(runs.status, ["queued", ...FINAL_STATUSES]))
    .limit(1);
  if (active) return;
  const [next] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.status, "queued"))
    .orderBy(asc(runs.id))
    .limit(1);
  if (!next) return;
  const run = await loadRun(db, next.id);
  if (!run) return;
  const committed = await commitTransition(
    db,
    run,
    { type: "start" },
    {
      events: [
        { actor: "system", kind: "started", message: "Arranca el run." },
      ],
    },
  );
  if (committed.applied) await executeEffects(run.id, committed.effects);
}

/** Applies an event that arrives from outside a step (GitHub, timeouts). */
export async function applyEvent(
  runId: number,
  event: RunEvent,
  events: EventDraft[],
  options: {
    /** Compare-and-swap against the version the caller saw (D22). */
    expectedVersion?: number;
    /** false: the caller runs the effects later (in after()). */
    runEffects?: boolean;
    /** Run columns set with the transition. */
    set?: RunSet;
  } = {},
): Promise<Committed> {
  const db = getDb();
  const run = await loadRun(db, runId);
  if (!run) return { applied: false };
  const version = options.expectedVersion ?? run.version;
  if (run.version !== version) return { applied: false };
  const committed = await commitTransition(db, run, event, {
    events,
    set: options.set,
  });
  if (committed.applied && options.runEffects !== false) {
    await executeEffects(runId, committed.effects);
  }
  return committed;
}

// --- Sweep (D22, D23) ---

const SWEEP_KEY = "runs_sweep_at";
const SWEEP_EVERY_SECONDS = 4;

/** At most one sweep every few seconds, however many tabs are polling. */
async function claimSweep(db: Db): Promise<boolean> {
  const rows = await db.execute(sql`
    insert into app_meta (key, value, updated_at) values (${SWEEP_KEY}, 'sweep', now())
    on conflict (key) do update set updated_at = now()
    where app_meta.updated_at < now() - make_interval(secs => ${SWEEP_EVERY_SECONDS})
    returning key`);
  return rows.rows.length > 0;
}

const olderThan = (date: Date, seconds: number) =>
  Date.now() - date.getTime() > seconds * 1000;

/**
 * Cheap recovery pass, called by the UI polling (no cron on Hobby): resumes
 * steps whose lease expired, notices previews that arrived without a
 * webhook, applies the timeouts, retries pending cleanups and starts the
 * queue.
 */
export async function sweep(): Promise<void> {
  const db = getDb();
  if (!(await claimSweep(db))) return;

  const open = await db
    .select()
    .from(runs)
    .where(
      sql`${runs.status} not in ('queued', 'done', 'rejected', 'cancelled', 'failed') or ${runs.cleanupPending}`,
    );

  for (const run of open) {
    try {
      await sweepRun(db, run);
    } catch (error) {
      console.error(`sweep run ${run.id}:`, error);
    }
  }
  await startNext();
}

/**
 * For a run waiting on its preview: moves it on if the E2E report or a
 * broken build for its head sha is already stored, and applies the
 * 15-minute timeout (D22). Covers webhooks that arrived before the run was
 * waiting for them.
 */
async function checkPreview(
  db: Db,
  run: typeof runs.$inferSelect,
  options: { timeout: boolean },
) {
  if (run.status !== "awaiting_preview" || !run.headSha) return;
  const report = await latestReport(db, run.headSha);
  if (report) {
    await applyEvent(
      run.id,
      { type: "report_ready" },
      [
        {
          actor: "github",
          kind: "report",
          message: `Informe E2E de ${short(run.headSha)} recibido.`,
        },
      ],
      { expectedVersion: run.version },
    );
    return;
  }
  const [preview] = await db
    .select({ state: previews.deployState, at: previews.deployUpdatedAt })
    .from(previews)
    .where(eq(previews.sha, run.headSha));
  if (
    preview?.at &&
    ["failure", "error"].includes(preview.state ?? "") &&
    olderThan(preview.at, BUILD_FAILURE_GRACE_SECONDS)
  ) {
    await applyEvent(
      run.id,
      { type: "build_failed" },
      [
        {
          actor: "github",
          kind: "build_failed",
          message: `El build de ${short(run.headSha)} ha fallado.`,
        },
      ],
      { expectedVersion: run.version },
    );
    return;
  }
  if (
    options.timeout &&
    olderThan(run.statusChangedAt, PREVIEW_TIMEOUT_MINUTES * 60)
  ) {
    await applyEvent(
      run.id,
      { type: "preview_timeout" },
      [
        {
          actor: "system",
          kind: "timeout",
          message: `La vista previa no ha llegado en ${PREVIEW_TIMEOUT_MINUTES} minutos.`,
        },
      ],
      { expectedVersion: run.version },
    );
  }
}

async function latestCheck(db: Db, sha: string) {
  const [check] = await db
    .select()
    .from(prChecks)
    .where(eq(prChecks.triggerSha, sha))
    .orderBy(desc(prChecks.completedAt), desc(prChecks.runAttempt))
    .limit(1);
  return check ?? null;
}

/** A pr-check result arrived for this sha: move the run waiting on it. */
export async function checkPrCheckFor(db: Db, sha: string) {
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.headSha, sha), eq(runs.status, "awaiting_check")));
  if (run) await checkPrCheck(db, run, { timeout: false });
}

/**
 * For a run waiting on pr-check (D31, D33): adopts the migration commit as
 * the head once the branch confirms it, and moves on to the preview or back
 * to Develop with the errors. Applies the 15-minute timeout.
 */
async function checkPrCheck(
  db: Db,
  run: typeof runs.$inferSelect,
  options: { timeout: boolean },
) {
  if (run.status !== "awaiting_check" || !run.headSha) return;
  const expectedVersion = run.version;
  const check = await latestCheck(db, run.headSha);
  if (!check) {
    if (
      options.timeout &&
      olderThan(run.statusChangedAt, CHECK_TIMEOUT_MINUTES * 60)
    ) {
      await applyEvent(
        run.id,
        { type: "check_timeout" },
        [
          {
            actor: "system",
            kind: "timeout",
            message: `La comprobación del PR no ha llegado en ${CHECK_TIMEOUT_MINUTES} minutos.`,
          },
        ],
        { expectedVersion },
      );
    }
    return;
  }

  // check.json comes from a job that runs the branch's code: the migration
  // commit only counts if the branch points to it and it sits on our head.
  let headSha = run.headSha;
  if (check.migrationSha) {
    const branch = runBranch(run.id);
    const current = await getBranchSha(branch);
    const parents =
      current === check.migrationSha
        ? await getCommitParents(check.migrationSha)
        : [];
    if (parents[0] !== run.headSha) {
      await applyEvent(
        run.id,
        {
          type: "block",
          reason: `La rama ${branch} no está en el commit de la migración (${short(check.migrationSha)})`,
        },
        [
          {
            actor: "system",
            kind: "blocked",
            message: `pr-check dice que subió la migración ${short(check.migrationSha)}, pero ${branch} está en ${current ? short(current) : "ningún commit"}.`,
          },
        ],
        { expectedVersion },
      );
      return;
    }
    headSha = check.migrationSha;
  }

  const migration =
    headSha !== run.headSha
      ? ` Migración generada en ${short(headSha)} (github-actions[bot]).`
      : "";
  const data = { runUrl: check.runUrl, migrationSha: check.migrationSha };
  if (check.status === "passed") {
    await applyEvent(
      run.id,
      { type: "check_passed" },
      [
        {
          actor: "github",
          kind: "check_passed",
          message: `pr-check de ${short(run.headSha)} en verde.${migration} Esperando la vista previa de ${short(headSha)}.`,
          data,
        },
      ],
      { expectedVersion, set: { headSha } },
    );
    return;
  }
  const feedback =
    check.status === "error"
      ? `${checkFeedback(null)}\n${check.error ?? ""}`.trim()
      : checkFeedback(check.errors);
  await applyEvent(
    run.id,
    { type: "check_failed", feedback },
    [
      {
        actor: "github",
        kind: "check_failed",
        message: `pr-check de ${short(run.headSha)} con errores: vuelven a Develop.${migration}`,
        data: { ...data, errors: check.errors, error: check.error },
      },
    ],
    // Adopted even on errors: the next commits go on top of the migration.
    { expectedVersion, set: { headSha } },
  );
}

async function sweepRun(db: Db, run: typeof runs.$inferSelect) {
  const status = run.status as RunStatus;
  if (isFinal(status)) {
    if (run.cleanupPending) await cleanup(run.id);
    return;
  }
  if (isStep(status)) {
    const expired =
      run.leaseUntil !== null && run.leaseUntil.getTime() < Date.now();
    const dropped =
      run.leaseUntil === null &&
      olderThan(run.statusChangedAt, STEP_GRACE_SECONDS);
    if (expired || dropped) await runStep(run.id);
    return;
  }
  if (status === "awaiting_preview") {
    await checkPreview(db, run, { timeout: true });
    return;
  }
  if (status === "awaiting_check") {
    await checkPrCheck(db, run, { timeout: true });
    return;
  }
  if (
    AWAITING_HUMAN.includes(status) &&
    olderThan(run.statusChangedAt, APPROVAL_TIMEOUT_HOURS * 3600)
  ) {
    await applyEvent(
      run.id,
      { type: "approval_timeout" },
      [
        {
          actor: "system",
          kind: "timeout",
          message: `Sin respuesta en ${APPROVAL_TIMEOUT_HOURS} h: se cancela el run.`,
        },
      ],
      { expectedVersion: run.version },
    );
  }
}
