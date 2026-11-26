import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { stepsSchema } from "@/server/agents/contracts";
import type { Db } from "@/server/db/client";
import {
  agentSteps,
  previews,
  runEvents,
  runs,
  tasks,
  testReports,
} from "@/server/db/schema";

export type RunListItem = Pick<
  typeof runs.$inferSelect,
  | "id"
  | "request"
  | "status"
  | "scenario"
  | "prNumber"
  | "createdAt"
  | "statusChangedAt"
>;

/** Newest runs first, for /runs. */
export async function listRuns(db: Db, limit = 30): Promise<RunListItem[]> {
  return db
    .select({
      id: runs.id,
      request: runs.request,
      status: runs.status,
      scenario: runs.scenario,
      prNumber: runs.prNumber,
      createdAt: runs.createdAt,
      statusChangedAt: runs.statusChangedAt,
    })
    .from(runs)
    .orderBy(desc(runs.id))
    .limit(limit);
}

/** Runs created since 00:00 UTC (D10). */
export async function runsCreatedToday(db: Db): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(runs)
    .where(gte(runs.createdAt, sql`date_trunc('day', now())`));
  return row?.n ?? 0;
}

export async function getRunDetail(db: Db, runId: number) {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  const [taskRows, events, steps, titles, stepsRows] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(
        and(eq(tasks.runId, runId), eq(tasks.planRevision, run.planRevision)),
      )
      .orderBy(asc(tasks.position)),
    db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId))
      .orderBy(asc(runEvents.id)),
    // Model and progress of each agent, for the cards (D42).
    db
      .select({
        agent: agentSteps.agent,
        taskId: agentSteps.taskId,
        iteration: agentSteps.iteration,
        scope: agentSteps.scope,
        model: agentSteps.model,
        createdAt: agentSteps.createdAt,
      })
      .from(agentSteps)
      .where(eq(agentSteps.runId, runId))
      .orderBy(asc(agentSteps.id)),
    // Titles of every revision, for the split groups (D43).
    db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(eq(tasks.runId, runId)),
    // Testing's steps of the current revision, shown folded (D43).
    db
      .select({ output: agentSteps.output })
      .from(agentSteps)
      .where(
        and(
          eq(agentSteps.runId, runId),
          eq(agentSteps.agent, "testing"),
          eq(agentSteps.scope, "steps"),
          eq(agentSteps.iteration, run.planRevision),
        ),
      ),
  ]);
  const parsedSteps = stepsSchema.safeParse(stepsRows[0]?.output);
  let preview: typeof previews.$inferSelect | null = null;
  let report: typeof testReports.$inferSelect | null = null;
  if (run.headSha) {
    const [p] = await db
      .select()
      .from(previews)
      .where(eq(previews.sha, run.headSha));
    const [r] = await db
      .select()
      .from(testReports)
      .where(eq(testReports.sha, run.headSha))
      .orderBy(desc(testReports.completedAt))
      .limit(1);
    preview = p ?? null;
    report = r ?? null;
  }
  // Reference for the "hace N min" of the cards (D42).
  const loadedAt = Date.now();
  return {
    run,
    tasks: taskRows,
    events,
    steps,
    taskTitles: new Map(titles.map((t) => [t.id, t.title])),
    criteriaSteps: parsedSteps.success ? parsedSteps.data : null,
    preview,
    report,
    loadedAt,
  };
}
export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRunDetail>>>;
