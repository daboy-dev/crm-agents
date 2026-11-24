import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { githubEvents } from "@/server/db/schema";

export type IncomingEvent = {
  deliveryId: string;
  event: string;
  action: string | null;
  payload: unknown;
};

export type RecordedEvent = {
  id: number;
  /** false when GitHub redelivered an event we already had. */
  inserted: boolean;
  processed: boolean;
};

/** Builds the idempotent insert: a redelivery hits the unique delivery_id and does nothing. */
export function insertEventQuery(db: Db, event: IncomingEvent) {
  return db
    .insert(githubEvents)
    .values(event)
    .onConflictDoNothing({ target: githubEvents.deliveryId })
    .returning({ id: githubEvents.id });
}

export async function recordEvent(
  db: Db,
  event: IncomingEvent,
): Promise<RecordedEvent> {
  const [inserted] = await insertEventQuery(db, event);
  if (inserted) return { id: inserted.id, inserted: true, processed: false };

  const [existing] = await db
    .select({ id: githubEvents.id, processedAt: githubEvents.processedAt })
    .from(githubEvents)
    .where(eq(githubEvents.deliveryId, event.deliveryId));
  if (!existing) throw new Error(`Event ${event.deliveryId} vanished`);
  return {
    id: existing.id,
    inserted: false,
    processed: existing.processedAt !== null,
  };
}
