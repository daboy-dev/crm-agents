import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";
import { insertEventQuery, type IncomingEvent } from "./events";
import { signGithubPayload } from "./signature";
import { handleGithubWebhook, type WebhookDeps } from "./webhook";

const SECRET = "webhook-secret";

/** In-memory stand-in for github_events with the same unique delivery_id. */
function fakeStore() {
  const rows = new Map<string, { id: number; processed: boolean }>();
  const record = vi.fn(async (event: IncomingEvent) => {
    const existing = rows.get(event.deliveryId);
    if (existing) return { ...existing, inserted: false };
    const row = { id: rows.size + 1, processed: false };
    rows.set(event.deliveryId, row);
    return { ...row, inserted: true };
  });
  return { rows, record };
}

function delivery(body: object, deliveryId = "d-1", secret = SECRET) {
  const raw = JSON.stringify(body);
  return new Request("https://panel.test/api/webhooks/github", {
    method: "POST",
    body: raw,
    headers: {
      "x-github-delivery": deliveryId,
      "x-github-event": "pull_request",
      "x-hub-signature-256": signGithubPayload(raw, secret),
    },
  });
}

function setup() {
  const store = fakeStore();
  const deps: WebhookDeps = {
    secret: SECRET,
    record: store.record,
    schedule: vi.fn(),
  };
  return { store, deps };
}

describe("handleGithubWebhook", () => {
  it("stores the event and schedules processing", async () => {
    const { store, deps } = setup();
    const res = await handleGithubWebhook(delivery({ action: "opened" }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: false });
    expect(store.record).toHaveBeenCalledWith({
      deliveryId: "d-1",
      event: "pull_request",
      action: "opened",
      payload: { action: "opened" },
    });
    expect(deps.schedule).toHaveBeenCalledWith(1);
  });

  it("rejects a bad signature without storing anything", async () => {
    const { store, deps } = setup();
    const res = await handleGithubWebhook(
      delivery({ action: "opened" }, "d-1", "wrong"),
      deps,
    );
    expect(res.status).toBe(401);
    expect(store.record).not.toHaveBeenCalled();
  });

  it("does not duplicate a redelivery", async () => {
    const { store, deps } = setup();
    await handleGithubWebhook(delivery({ action: "opened" }), deps);
    store.rows.get("d-1")!.processed = true;
    const res = await handleGithubWebhook(delivery({ action: "opened" }), deps);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(store.rows.size).toBe(1);
    expect(deps.schedule).toHaveBeenCalledTimes(1);
  });

  it("retries a redelivery that was never processed", async () => {
    const { deps } = setup();
    await handleGithubWebhook(delivery({ action: "opened" }), deps);
    await handleGithubWebhook(delivery({ action: "opened" }), deps);
    expect(deps.schedule).toHaveBeenCalledTimes(2);
    expect(deps.schedule).toHaveBeenLastCalledWith(1);
  });
});

describe("insertEventQuery", () => {
  it("ignores conflicts on delivery_id", () => {
    const db = drizzle(neon("postgresql://u:p@host.test/db"), { schema });
    const { sql } = insertEventQuery(db, {
      deliveryId: "d-1",
      event: "ping",
      action: null,
      payload: {},
    }).toSQL();
    expect(sql).toMatch(/on conflict \("delivery_id"\) do nothing/i);
    expect(sql).toMatch(/returning "id"/i);
  });
});
