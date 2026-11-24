import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
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
  const [taskRows, events] = await Promise.all([
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
  ]);
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
  return { run, tasks: taskRows, events, preview, report };
}
export type RunDetail = NonNullable<Awaited<ReturnType<typeof getRunDetail>>>;
