import { and, asc, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { runDevelop, runOrchestrator, runTesting } from "@/server/agents";
import {
  developOutputSchema,
  planSchema,
  verdictSchema,
  type AgentName,
  type E2eSummary,
  type TaskBrief,
} from "@/server/agents/contracts";
import { checkPaths } from "@/server/agents/paths";
import { getDb, type Db } from "@/server/db/client";
import {
  agentSteps,
  previews,
  runs,
  tasks,
  testReports,
} from "@/server/db/schema";
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
  getCommitTree,
  getPr,
  mergePr,
  moveBranch,
} from "@/server/github/repo";
import { getProvider, runProviders } from "@/server/llm";
import type { Generated, LLMProvider } from "@/server/llm/provider";
import { llmCallsPerRun } from "./limits";
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
  type TaskRow,
} from "./store";

/** A step that fails this many times in a row fails the run. */
const MAX_STEP_ATTEMPTS = 3;
/** A step state without a lease for this long is considered dropped. */
const STEP_GRACE_SECONDS = 30;
const PREVIEW_TIMEOUT_MINUTES = 15;
/**
 * A failed deployment only counts as a broken build if no success replaces
 * it in this time: Vercel fails the first deployment of a new branch and
 * then succeeds on the same deployment (seen in H3).
 */
const BUILD_FAILURE_GRACE_SECONDS = 180;
const APPROVAL_TIMEOUT_HOURS = 24;

class BlockRun extends Error {}
class SimulatedCrash extends Error {}

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
  acceptanceCriteria: t.acceptanceCriteria,
});

/**
 * Returns the stored output of an LLM call, or makes the call and stores it
 * (D22). A retried step never calls the LLM twice for the same key.
 */
async function cachedCall<T>(
  ctx: StepContext,
  key: { agent: AgentName; taskId: number | null; iteration: number },
  schema: z.ZodType<T>,
  call: () => Promise<Generated<T>>,
): Promise<T> {
  const where = and(
    eq(agentSteps.runId, ctx.run.id),
    key.taskId === null
      ? isNull(agentSteps.taskId)
      : eq(agentSteps.taskId, key.taskId),
    eq(agentSteps.iteration, key.iteration),
    eq(agentSteps.agent, key.agent),
  );
  const [stored] = await ctx.db.select().from(agentSteps).where(where);
  if (stored) return schema.parse(stored.output);

  if (ctx.run.llmCalls >= llmCallsPerRun()) {
    throw new BlockRun(
      `Se ha llegado al máximo de ${llmCallsPerRun()} llamadas al LLM del run`,
    );
  }
  const { output } = await call();
  const [inserted] = await ctx.db
    .insert(agentSteps)
    .values({ runId: ctx.run.id, ...key, output })
    .onConflictDoNothing()
    .returning({ id: agentSteps.id });
  await ctx.db
    .update(runs)
    .set({ llmCalls: sql`${runs.llmCalls} + 1` })
    .where(eq(runs.id, ctx.run.id));
  ctx.run.llmCalls += 1;
  if (inserted) return output;
  // Another attempt stored it first: use that one.
  const [winner] = await ctx.db.select().from(agentSteps).where(where);
  return schema.parse(winner!.output);
}

// --- Steps ---

async function stepPlanning(ctx: StepContext): Promise<Committed> {
  const { db, run } = ctx;
  const plan = await cachedCall(
    ctx,
    { agent: "orchestrator", taskId: null, iteration: run.planRevision },
    planSchema,
    async () =>
      runOrchestrator(await ctx.llm("orchestrator"), {
        runId: run.id,
        request: run.request,
        planRevision: run.planRevision,
        mode: "replace",
        feedback: run.feedback,
        previous: null,
        // Read from crm-demo once the engine wires the context in (D27).
        context: { baseSha: "", tree: [], files: [] },
      }),
  );
  await db
    .insert(tasks)
    .values(
      plan.tasks.map((t, i) => ({
        runId: run.id,
        planRevision: run.planRevision,
        position: i + 1,
        ...t,
      })),
    )
    .onConflictDoNothing();
  const withTasks = (await loadRun(db, run.id))!;
  return commitTransition(
    db,
    withTasks,
    { type: "plan_ready" },
    {
      leaseToken: ctx.token,
      set: { planSummary: plan.summary },
      events: [
        {
          actor: "orchestrator",
          kind: "plan",
          message: `Plan (revisión ${run.planRevision}) con ${plan.tasks.length} tareas: ${plan.summary}`,
          data: plan,
        },
      ],
    },
  );
}

async function stepDeveloping(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  const branch = runBranch(run.id);
  const work = run.tasks.filter((t) => t.status === "developing");
  if (work.length === 0) throw new Error("No hay tareas en desarrollo");

  const outputs = [];
  for (const task of work) {
    const output = await cachedCall(
      ctx,
      { agent: "develop", taskId: task.id, iteration: task.iteration },
      developOutputSchema,
      async () =>
        runDevelop(await ctx.llm("develop"), {
          runId: run.id,
          request: run.request,
          task: brief(task),
          iteration: task.iteration,
          feedback: task.lastFeedback,
        }),
    );
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
    outputs.push({ task, output });
  }

  // 1. Build the commit chain once and remember it before touching the ref.
  let targetSha = run.targetSha;
  let commits = run.targetCommits ?? {};
  if (!targetSha) {
    const current = await getBranchSha(branch);
    if (current !== run.headSha) {
      throw new BlockRun(
        `La rama ${branch} no está en el commit esperado (${current ? short(current) : "no existe"})`,
      );
    }
    let parent = run.headSha ?? (await getBaseSha());
    let tree = await getCommitTree(parent);
    commits = {};
    for (const { task, output } of outputs) {
      tree = await createTree(tree, output.files);
      parent = await createCommit({
        message: output.commitMessage,
        tree,
        parent,
      });
      commits[String(task.id)] = parent;
    }
    targetSha = parent;
    await checkpoint(db, run, token, { targetSha, targetCommits: commits });
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
    throw new SimulatedCrash();
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
        outputs.map(({ task }) => [
          task.id,
          { commitSha: commits[String(task.id)] ?? null },
        ]),
      ),
      events: [
        ...outputs.map(({ task, output }) => ({
          actor: "develop" as const,
          kind: "commit",
          message: `Tarea ${task.position}, iteración ${task.iteration}: commit ${short(commits[String(task.id)] ?? "")} · ${output.commitMessage}`,
          data: { files: output.files.map((f) => f.path) },
        })),
        {
          actor: "system",
          kind: "pushed",
          message: `Rama ${branch} en ${short(targetSha)} · PR #${prNumber}. Esperando la vista previa.`,
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

async function stepTesting(ctx: StepContext): Promise<Committed> {
  const { db, run, token } = ctx;
  if (!run.headSha) throw new Error("El run no tiene commit");
  const report = await latestReport(db, run.headSha);
  if (!report) throw new Error(`No hay informe E2E para ${short(run.headSha)}`);
  const summary: E2eSummary = {
    status: report.status,
    passed: report.passed,
    failed: report.failed,
    failures: report.failures,
  };

  const verdicts: Verdict[] = [];
  const events: EventDraft[] = [];
  for (const task of run.tasks.filter((t) => t.status === "testing")) {
    const verdict = await cachedCall(
      ctx,
      { agent: "testing", taskId: task.id, iteration: task.iteration },
      verdictSchema,
      async () =>
        runTesting(await ctx.llm("testing"), {
          runId: run.id,
          task: brief(task),
          iteration: task.iteration,
          report: summary,
        }),
    );
    verdicts.push({
      taskId: task.id,
      passed: verdict.passed,
      feedback: verdict.summary,
    });
    events.push({
      actor: "testing",
      kind: verdict.passed ? "passed" : "failed",
      message: `Tarea ${task.position}, iteración ${task.iteration}: ${verdict.passed ? "pasa" : "falla"}. ${verdict.summary}`,
      data: verdict,
    });
  }
  return commitTransition(
    db,
    run,
    { type: "testing_done", verdicts },
    {
      leaseToken: token,
      events: [
        {
          actor: "system",
          kind: "report",
          message: `Informe E2E de ${short(run.headSha)}: ${report.passed} pasan, ${report.failed} fallan.`,
          data: { reportId: report.id },
        },
        ...events,
      ],
    },
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
export async function runStep(runId: number): Promise<void> {
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

  let committed: Committed;
  try {
    committed = await STEPS[run.status as keyof typeof STEPS](ctx);
  } catch (error) {
    committed = await stepFailed(ctx, error);
  }
  if (committed.applied) await executeEffects(runId, committed.effects);
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
      message:
        "Caída simulada justo después de mover la rama. El sweep reanudará el paso cuando caduque el lease.",
    });
    return { applied: false };
  }
  if (error instanceof BlockRun) {
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
  } = {},
): Promise<Committed> {
  const db = getDb();
  const run = await loadRun(db, runId);
  if (!run) return { applied: false };
  const version = options.expectedVersion ?? run.version;
  if (run.version !== version) return { applied: false };
  const committed = await commitTransition(db, run, event, { events });
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
