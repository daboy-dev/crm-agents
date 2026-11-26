/**
 * Preconditions of the human's actions (D47). Each button sends what the
 * human sees (plan revision, head sha or status) instead of the run version,
 * so a version bumped by a webhook or the sweep does not leave the button
 * without effect, and nothing is approved that is not on screen. Pure: the
 * server action reads the current run, checks here and then does the CAS of
 * D22 with the current version.
 */

import { AWAITING_HUMAN, FINAL_STATUSES, type RunStatus } from "./machine";

export const HUMAN_ACTIONS = [
  "approve_plan",
  "approve_final",
  "reject",
  "retry",
  "cancel",
] as const;
export type HumanAction = (typeof HUMAN_ACTIONS)[number];

/** What the page showed, or what the run is now. */
export type RunView = {
  status: RunStatus;
  planRevision: number;
  headSha: string | null;
};

export type Precondition =
  | { ok: true }
  /** already: the action had been applied (another tab, a double click). */
  | { ok: false; already: boolean; message: string };

const OK: Precondition = { ok: true };
const already = (message: string): Precondition => ({
  ok: false,
  already: true,
  message,
});
const changed = (message: string): Precondition => ({
  ok: false,
  already: false,
  message,
});

const short = (sha: string | null) => (sha ? sha.slice(0, 7) : "sin commit");

/** The agents are working: neither waiting for the human nor blocked. */
const working = (s: RunStatus) =>
  !AWAITING_HUMAN.includes(s) && s !== "blocked" && !FINAL_STATUSES.includes(s);

export function checkPrecondition(
  action: HumanAction,
  seen: RunView,
  now: RunView,
): Precondition {
  if (FINAL_STATUSES.includes(now.status)) {
    if (action === "cancel" && now.status === "cancelled")
      return already("Ya estaba cancelado.");
    if (action === "reject" && now.status === "rejected")
      return already("Ya estaba rechazado.");
    if (
      action === "approve_final" &&
      now.status === "done" &&
      now.headSha === seen.headSha
    )
      return already("Ya estaba aprobado y fusionado.");
    return changed("El run ya ha terminado: no se ha hecho nada.");
  }

  switch (action) {
    case "approve_plan":
      if (now.status === "awaiting_plan_approval") {
        return now.planRevision === seen.planRevision
          ? OK
          : changed(
              `El run ha cambiado: revisa la revisión ${now.planRevision} antes de aprobar.`,
            );
      }
      if (
        now.planRevision === seen.planRevision &&
        now.status !== "queued" &&
        now.status !== "planning"
      )
        return already("Ya estaba aprobado.");
      return changed(
        `El run ha cambiado: el Orquestador prepara la revisión ${now.planRevision}.`,
      );

    case "approve_final":
      if (now.status === "awaiting_final_approval") {
        return now.headSha === seen.headSha
          ? OK
          : changed(
              `El run ha cambiado: revisa la vista previa de ${short(now.headSha)} antes de aprobar.`,
            );
      }
      if (now.status === "merging" && now.headSha === seen.headSha)
        return already("Ya estaba aprobado.");
      return changed("El run ha cambiado: ya no espera la aprobación final.");

    case "reject":
      if (
        now.status === seen.status &&
        AWAITING_HUMAN.includes(now.status) &&
        now.planRevision === seen.planRevision &&
        now.headSha === seen.headSha
      )
        return OK;
      if (
        AWAITING_HUMAN.includes(seen.status) &&
        now.planRevision > seen.planRevision
      )
        return already("Ya se había enviado feedback: se vuelve a planificar.");
      return changed("El run ha cambiado: revisa lo que se muestra ahora.");

    case "retry":
      if (now.status === "blocked") return OK;
      return already("Ya se había reintentado.");

    case "cancel":
      // Cancelling while the agents work stays valid as the status moves on.
      if (now.status === seen.status) return OK;
      if (working(seen.status) && working(now.status)) return OK;
      return changed("El run ha cambiado: revisa lo que se muestra ahora.");
  }
}
