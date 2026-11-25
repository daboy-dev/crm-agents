"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { runs } from "@/server/db/schema";
import {
  providersForNewRun,
  providerSummary,
  usesMockScenario,
} from "@/server/llm";
import { MOCK_SCENARIOS } from "@/server/llm/mock";
import {
  applyEvent,
  executeEffects,
  startNext,
  sweep,
} from "@/server/runs/engine";
import { runsPerDay } from "@/server/runs/limits";
import type { RunEvent } from "@/server/runs/machine";
import { runsCreatedToday } from "@/server/runs/queries";
import { appendEvent, type EventDraft } from "@/server/runs/store";
import { currentUser } from "@/server/session";

export type FormState = { error: string | null };

async function requireUser(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

const newRunSchema = z.object({
  request: z
    .string()
    .trim()
    .min(10, "Describe la petición (al menos 10 caracteres).")
    .max(2000),
  scenario: z.enum(MOCK_SCENARIOS).optional(),
  simulateCrash: z.literal("on").optional(),
  simulatePlanCrash: z.literal("on").optional(),
  simulateTypeError: z.literal("on").optional(),
  simulateMaxTokens: z.literal("on").optional(),
});

/** New request from the client (D25). It waits in the queue if a run is active. */
export async function createRun(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const providers = providersForNewRun();
  const mock = usesMockScenario(providers);
  const parsed = newRunSchema.safeParse({
    request: formData.get("request") ?? "",
    scenario: mock ? (formData.get("scenario") ?? "ok") : undefined,
    simulateCrash: formData.get("simulateCrash") ?? undefined,
    simulatePlanCrash: formData.get("simulatePlanCrash") ?? undefined,
    simulateTypeError: formData.get("simulateTypeError") ?? undefined,
    simulateMaxTokens: formData.get("simulateMaxTokens") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  }
  const db = getDb();
  if ((await runsCreatedToday(db)) >= runsPerDay()) {
    return {
      error: `Se ha llegado al límite de ${runsPerDay()} runs por día.`,
    };
  }
  const [run] = await db
    .insert(runs)
    .values({
      request: parsed.data.request,
      provider: providerSummary(providers),
      providers,
      scenario: parsed.data.scenario ?? null,
      // H5: the crash after the commit also works with a real Develop.
      simulateCrash: parsed.data.simulateCrash === "on",
      simulatePlanCrash: parsed.data.simulatePlanCrash === "on",
      simulateTypeError: parsed.data.simulateTypeError === "on",
      simulateMaxTokens: parsed.data.simulateMaxTokens === "on",
    })
    .returning();
  if (!run) return { error: "No se ha podido crear el run." };
  await appendEvent(db, run, {
    actor: "human",
    kind: "request",
    message: `Petición: ${run.request}`,
    data: {
      providers,
      scenario: run.scenario,
      simulateCrash: run.simulateCrash,
      simulatePlanCrash: run.simulatePlanCrash,
      simulateTypeError: run.simulateTypeError,
      simulateMaxTokens: run.simulateMaxTokens,
    },
  });
  after(() => startNext());
  redirect(`/runs/${run.id}`);
}

const actionSchema = z.object({
  runId: z.coerce.number().int().positive(),
  version: z.coerce.number().int().min(0),
  action: z.enum([
    "approve_plan",
    "approve_final",
    "reject",
    "retry",
    "cancel",
  ]),
  feedback: z.string().trim().max(2000).optional(),
});

/**
 * Approve, reject, retry or cancel. The form carries the run version it
 * was rendered with, so a double click or a stale tab does nothing (D22).
 */
export async function runAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = actionSchema.safeParse({
    runId: formData.get("runId"),
    version: formData.get("version"),
    action: formData.get("action"),
    feedback: formData.get("feedback") ?? undefined,
  });
  if (!parsed.success) return { error: "Acción no válida." };
  const { runId, version, action } = parsed.data;
  const feedback = parsed.data.feedback || null;

  let event: RunEvent;
  let note: EventDraft;
  switch (action) {
    case "approve_plan":
      event = { type: "approve_plan" };
      note = { actor: "human", kind: "approved", message: "Plan aprobado." };
      break;
    case "approve_final":
      event = { type: "approve_final" };
      note = {
        actor: "human",
        kind: "approved",
        message: "Vista previa aprobada: se fusiona el PR.",
      };
      break;
    case "reject":
      event = { type: "reject", feedback };
      note = feedback
        ? {
            actor: "human",
            kind: "feedback",
            message: `Feedback: «${feedback}». Se vuelve a planificar.`,
          }
        : {
            actor: "human",
            kind: "rejected",
            message: "Rechazado sin feedback.",
          };
      break;
    case "retry":
      event = { type: "retry" };
      note = { actor: "human", kind: "retry", message: "Reintentar." };
      break;
    case "cancel":
      event = { type: "cancel" };
      note = {
        actor: "human",
        kind: "cancelled",
        message: "Cancelado por el cliente.",
      };
      break;
  }

  const committed = await applyEvent(runId, event, [note], {
    expectedVersion: version,
    runEffects: false,
  });
  if (!committed.applied) {
    refresh();
    return { error: "El run ha cambiado mientras tanto: no se ha hecho nada." };
  }
  after(() => executeEffects(runId, committed.effects));
  refresh();
  return { error: null };
}

/** Called by the polling of /runs pages: recovery without cron (D22). */
export async function sweepRuns(): Promise<void> {
  if (!(await currentUser())) return;
  after(() => sweep());
}
