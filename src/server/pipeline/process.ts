import { asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, type Db } from "@/server/db/client";
import { githubEvents } from "@/server/db/schema";
import { classifyEvent } from "./classify";
import { applyDeployment, applyPullRequest } from "./previews";

async function runEvent(db: Db, event: string, payload: unknown) {
  const classified = classifyEvent(event, payload);
  switch (classified.kind) {
    case "pull_request":
      return applyPullRequest(db, classified.update);
    case "deployment_status":
      return applyDeployment(db, classified.update);
    case "workflow_run":
      // The artifact step lands in the next commit; keep it pending.
      throw new Error("workflow_run processing not available yet");
    case "ignored":
      return;
  }
}

/**
 * Processes one stored event. Every step is idempotent, so running it again
 * (redelivery or manual reprocess) never duplicates anything. On failure the
 * error is stored and processed_at stays null.
 */
export async function processEvent(eventId: number): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(githubEvents)
    .where(eq(githubEvents.id, eventId));
  if (!row || row.processedAt) return;

  try {
    await runEvent(db, row.event, row.payload);
    await db
      .update(githubEvents)
      .set({
        processedAt: new Date(),
        error: null,
        attempts: sql`${githubEvents.attempts} + 1`,
      })
      .where(eq(githubEvents.id, eventId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`github event ${eventId} failed:`, message);
    await db
      .update(githubEvents)
      .set({
        error: message.slice(0, 2000),
        attempts: sql`${githubEvents.attempts} + 1`,
      })
      .where(eq(githubEvents.id, eventId));
  }
}

/** Reprocesses events that are unprocessed or failed, oldest first. */
export async function reprocessPending(limit = 50): Promise<number> {
  const pending = await getDb()
    .select({ id: githubEvents.id })
    .from(githubEvents)
    .where(isNull(githubEvents.processedAt))
    .orderBy(asc(githubEvents.id))
    .limit(limit);
  for (const { id } of pending) await processEvent(id);
  return pending.length;
}
