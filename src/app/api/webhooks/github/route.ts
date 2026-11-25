import { after } from "next/server";
import { getDb } from "@/server/db/client";
import { recordEvent } from "@/server/github/events";
import { handleGithubWebhook } from "@/server/github/webhook";
import { processEvent } from "@/server/pipeline/process";

/**
 * Processing in after() downloads the artifacts and may run the next step:
 * a pr-check with errors starts Develop, whose call can take 150 s (D35).
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleGithubWebhook(request, {
    secret: process.env.GH_WEBHOOK_SECRET ?? "",
    record: (event) => recordEvent(getDb(), event),
    schedule: (eventId) => after(() => processEvent(eventId)),
  });
}
