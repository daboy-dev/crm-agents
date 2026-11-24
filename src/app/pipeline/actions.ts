"use server";

import { refresh } from "next/cache";
import { reprocessPending } from "@/server/pipeline/process";
import { currentUser } from "@/server/session";

/** Reprocesses GitHub events that are unprocessed or failed. */
export async function reprocessEvents(): Promise<void> {
  if (!(await currentUser())) throw new Error("unauthorized");
  await reprocessPending();
  refresh();
}
