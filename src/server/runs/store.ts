import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { Db } from "@/server/db/client";
import { runEvents, runs, tasks } from "@/server/db/schema";
import {
  transition,
  type Effect,
  type RunEvent,
  type RunState,
  type RunStatus,
  type TaskStatus,
} from "./machine";

/** A step holds the run for this long; the sweep resumes it afterwards (D22). */
export const LEASE_SECONDS = 90;

export type RunRow = typeof runs.$inferSelect;
export type RunSet = PgUpdateSetSource<typeof runs>;
export type TaskSet = PgUpdateSetSource<typeof tasks>;
export type TaskRow = typeof tasks.$inferSelect;
export type LoadedRun = RunRow & { tasks: TaskRow[] };

export type Actor =
  "orchestrator" | "develop" | "testing" | "human" | "system" | "github";

export type EventDraft = {
  actor: Actor;
  kind: string;
  message: string;
  data?: unknown;
};

/** Run with the tasks of its current plan revision, by position. */
export async function loadRun(
  db: Db,
  runId: number,
): Promise<LoadedRun | null> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (!run) return null;
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.runId, runId), eq(tasks.planRevision, run.planRevision)),
    )
    .orderBy(asc(tasks.position));
  return { ...run, tasks: rows };
}

export function snapshot(run: LoadedRun): RunState {
  return {
    status: run.status as RunStatus,
    tasks: run.tasks.map((t) => ({
      id: t.id,
      status: t.status as TaskStatus,
      iteration: t.iteration,
      maxIterations: t.maxIterations,
    })),
    blockedFrom: (run.blockedFrom as RunStatus | null) ?? null,
    hasBranch:
      run.headSha !== null || run.targetSha !== null || run.prNumber !== null,
  };
}

export type Committed =
  | { applied: true; status: RunStatus; version: number; effects: Effect[] }
  | { applied: false };

const NOT_APPLIED: Committed = { applied: false };

/** Postgres unique violation, unwrapped from Drizzle's query error. */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Builds the compare-and-swap of one transition as a single statement (D22):
 * the run update is a CTE and the timeline events and task changes hang off
 * it, so they only happen when the run row was updated. Exported for tests.
 */
export function transitionStatement(
  db: Db,
  input: {
    runId: number;
    version: number;
    leaseToken?: string;
    set: RunSet;
    events: EventDraft[];
    tasks: { id: number; set: TaskSet }[];
  },
): SQL {
  const conditions = [
    eq(runs.id, input.runId),
    eq(runs.version, input.version),
  ];
  if (input.leaseToken) conditions.push(eq(runs.leaseToken, input.leaseToken));
  const update = db
    .update(runs)
    .set({
      ...input.set,
      version: sql`${runs.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(...conditions))
    .returning({ id: runs.id, version: runs.version });

  const ctes: SQL[] = [sql`upd as (${update.getSQL()})`];
  input.events.forEach((e, i) => {
    const data = e.data === undefined ? null : JSON.stringify(e.data);
    ctes.push(
      sql`${sql.raw(`ev${i}`)} as (insert into ${runEvents} (run_id, run_version, actor, kind, message, data) select id, version, ${e.actor}::text, ${e.kind}::text, ${e.message}::text, ${data}::jsonb from upd)`,
    );
  });
  input.tasks.forEach((t, i) => {
    const taskUpdate = db
      .update(tasks)
      .set(t.set)
      .where(
        and(eq(tasks.id, t.id), sql`${tasks.runId} in (select id from upd)`),
      );
    ctes.push(sql`${sql.raw(`tk${i}`)} as (${taskUpdate.getSQL()})`);
  });
  return sql`with ${sql.join(ctes, sql`, `)} select id, version from upd`;
}

/**
 * Applies an event to a run: computes the transition and persists it with a
 * compare-and-swap. Returns applied: false when the event does not apply or
 * another process moved the run first; the caller then does nothing.
 */
export async function commitTransition(
  db: Db,
  run: LoadedRun,
  event: RunEvent,
  options: {
    events: EventDraft[];
    set?: RunSet;
    taskSet?: Record<number, TaskSet>;
    leaseToken?: string;
  },
): Promise<Committed> {
  const next = transition(snapshot(run), event);
  if (!next) return NOT_APPLIED;

  const set: RunSet = {
    status: next.status,
    statusChangedAt: sql`now()`,
    blockedFrom: next.blockedFrom,
    blockedReason: next.blockedReason,
    leaseUntil: null,
    leaseToken: null,
    stepAttempts: 0,
    ...options.set,
  };
  if (next.effects.some((e) => e.type === "cleanup")) set.cleanupPending = true;
  if (next.replan) {
    set.planRevision = run.planRevision + 1;
    set.feedback = next.replan.feedback;
  }

  const taskIds = new Set([
    ...next.tasks.map((t) => t.id),
    ...Object.keys(options.taskSet ?? {}).map(Number),
  ]);
  const taskUpdates = [...taskIds].map((id) => {
    const change = next.tasks.find((t) => t.id === id);
    const { id: _id, ...fields } = change ?? { id };
    void _id;
    return { id, set: { ...fields, ...options.taskSet?.[id] } };
  });

  try {
    const result = await db.execute<{ id: number; version: number }>(
      transitionStatement(db, {
        runId: run.id,
        version: run.version,
        leaseToken: options.leaseToken,
        set,
        events: options.events,
        tasks: taskUpdates.filter((t) => Object.keys(t.set).length > 0),
      }),
    );
    const row = result.rows[0];
    if (!row) return NOT_APPLIED;
    return {
      applied: true,
      status: next.status,
      version: row.version,
      effects: next.effects,
    };
  } catch (error) {
    // Starting a run while another one is active hits runs_one_active_uq.
    if (isUniqueViolation(error)) return NOT_APPLIED;
    throw error;
  }
}

/** Takes the run for a step. Returns the lease token, or null if it is held. */
export async function acquireLease(
  db: Db,
  run: LoadedRun,
): Promise<string | null> {
  const token = randomUUID();
  const [row] = await db
    .update(runs)
    .set({
      leaseToken: token,
      leaseUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})`,
    })
    .where(
      and(
        eq(runs.id, run.id),
        eq(runs.version, run.version),
        eq(runs.status, run.status),
        or(isNull(runs.leaseUntil), lt(runs.leaseUntil, sql`now()`)),
      ),
    )
    .returning({ id: runs.id });
  return row ? token : null;
}

export class LeaseLost extends Error {
  constructor(runId: number) {
    super(`Run ${runId}: lease lost`);
  }
}

/**
 * Saves progress inside a step without changing the status, only while the
 * step still holds its lease.
 */
export async function checkpoint(
  db: Db,
  run: LoadedRun,
  token: string,
  set: RunSet,
): Promise<void> {
  const [row] = await db
    .update(runs)
    .set({ ...set, updatedAt: sql`now()` })
    .where(
      and(
        eq(runs.id, run.id),
        eq(runs.version, run.version),
        eq(runs.leaseToken, token),
      ),
    )
    .returning({ id: runs.id });
  if (!row) throw new LeaseLost(run.id);
}

/** Timeline entry outside a transition (errors, GitHub notices). */
export async function appendEvent(
  db: Db,
  run: Pick<RunRow, "id" | "version">,
  event: EventDraft,
) {
  await db.insert(runEvents).values({
    runId: run.id,
    runVersion: run.version,
    actor: event.actor,
    kind: event.kind,
    message: event.message,
    data: event.data ?? null,
  });
}
