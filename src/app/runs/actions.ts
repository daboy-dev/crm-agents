"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
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
import {
  RUN_STATUSES,
  type RunEvent,
  type RunStatus,
} from "@/server/runs/machine";
import { runsCreatedToday } from "@/server/runs/queries";
import {
  checkPrecondition,
  HUMAN_ACTIONS,
  type RunView,
} from "@/server/runs/human";
import { appendEvent, type EventDraft } from "@/server/runs/store";
import { currentUser } from "@/server/session";

export type FormState = {
  error: string | null;
  /** The action was not applied, but nothing went wrong (D47). */
  notice?: string | null;
};

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
  simulateCriterionFail: z.literal("on").optional(),
  simulatePersistentFail: z.literal("on").optional(),
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
    simulateCriterionFail: formData.get("simulateCriterionFail") ?? undefined,
    simulatePersistentFail: formData.get("simulatePersistentFail") ?? undefined,
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
      // H6 (D40): the persistent failure includes the single one.
      simulateCriterionFail: parsed.data.simulateCriterionFail === "on",
      simulatePersistentFail: parsed.data.simulatePersistentFail === "on",
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
      simulateCriterionFail: run.simulateCriterionFail,
      simulatePersistentFail: run.simulatePersistentFail,
    },
  });
  after(() => startNext());
  redirect(`/runs/${run.id}`);
}

const actionSchema = z.object({
  runId: z.coerce.number().int().positive(),
  action: z.enum(HUMAN_ACTIONS),
  // What the page showed (D47).
  status: z.enum(RUN_STATUSES),
  planRevision: z.coerce.number().int().positive(),
  headSha: z.string().trim().max(64).optional(),
  feedback: z.string().trim().max(2000).optional(),
});

/** Reads tried before giving up when the run keeps moving under the CAS. */
const ATTEMPTS = 3;

/**
 * Approve, reject, retry or cancel. The form carries what the human sees
 * (D47); the server checks it against the current run and does the CAS of
 * D22 with the current version, so a version bumped elsewhere does not
 * leave the button without effect.
 */
export async function runAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = actionSchema.safeParse({
    runId: formData.get("runId"),
    action: formData.get("action"),
    status: formData.get("status"),
    planRevision: formData.get("planRevision"),
    headSha: formData.get("headSha") ?? undefined,
    feedback: formData.get("feedback") ?? undefined,
  });
  if (!parsed.success) return { error: "Acción no válida." };
  const { runId, action } = parsed.data;
  const seen: RunView = {
    status: parsed.data.status,
    planRevision: parsed.data.planRevision,
    headSha: parsed.data.headSha || null,
  };
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

  const db = getDb();
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) return { error: "El run no existe." };
    const check = checkPrecondition(action, seen, {
      status: run.status as RunStatus,
      planRevision: run.planRevision,
      headSha: run.headSha,
    });
    if (!check.ok) {
      refresh();
      return { error: null, notice: check.message };
    }
    const committed = await applyEvent(runId, event, [note], {
      expectedVersion: run.version,
      runEffects: false,
    });
    if (committed.applied) {
      after(() => executeEffects(runId, committed.effects));
      refresh();
      return { error: null };
    }
    // The version moved between the read and the CAS: read it again.
  }
  refresh();
  return { error: "No se ha podido aplicar la acción: vuelve a intentarlo." };
}

/** Called by the polling of /runs pages: recovery without cron (D22). */
export async function sweepRuns(): Promise<void> {
  if (!(await currentUser())) return;
  after(() => sweep());
}
