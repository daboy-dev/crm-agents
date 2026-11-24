import { after } from "next/server";
import { getDb } from "@/server/db/client";
import { recordEvent } from "@/server/github/events";
import { handleGithubWebhook } from "@/server/github/webhook";
import { processEvent } from "@/server/pipeline/process";

/** Processing in after() downloads the artifact and uploads screenshots. */
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleGithubWebhook(request, {
    secret: process.env.GH_WEBHOOK_SECRET ?? "",
    record: (event) => recordEvent(getDb(), event),
    schedule: (eventId) => after(() => processEvent(eventId)),
  });
}
