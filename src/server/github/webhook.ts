import type { IncomingEvent, RecordedEvent } from "./events";
import { verifyGithubSignature } from "./signature";

export type WebhookDeps = {
  secret: string;
  record: (event: IncomingEvent) => Promise<RecordedEvent>;
  /** Schedules processing after the response (next/server `after`). */
  schedule: (eventId: number) => void;
};

/**
 * Verifies, stores and acknowledges a GitHub delivery (D17). Processing is
 * scheduled for after the response, because GitHub gives up after 10 s. A
 * redelivery of an event already processed is acknowledged and ignored.
 */
export async function handleGithubWebhook(
  request: Request,
  deps: WebhookDeps,
): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGithubSignature(rawBody, signature, deps.secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const deliveryId = request.headers.get("x-github-delivery");
  const event = request.headers.get("x-github-event");
  if (!deliveryId || !event) {
    return Response.json({ error: "missing headers" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const action =
    typeof payload === "object" &&
    payload !== null &&
    "action" in payload &&
    typeof payload.action === "string"
      ? payload.action
      : null;

  const recorded = await deps.record({ deliveryId, event, action, payload });
  if (!recorded.processed) deps.schedule(recorded.id);
  return Response.json({ ok: true, duplicate: !recorded.inserted });
}
