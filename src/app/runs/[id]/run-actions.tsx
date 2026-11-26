"use client";

import { useActionState, useState } from "react";
import { runAction, type FormState } from "../actions";

type Props = {
  runId: number;
  status: string;
  planRevision: number;
  headSha: string | null;
};

/** What the human sees, checked by the server before applying (D47). */
function Hidden({ runId, status, planRevision, headSha }: Props) {
  return (
    <>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="planRevision" value={planRevision} />
      <input type="hidden" name="headSha" value={headSha ?? ""} />
    </>
  );
}

/**
 * Buttons for the human (D9). Each form carries what it approves (D47).
 * When it is the human's turn, on mobile it is a bar fixed at the bottom
 * (D46); the feedback field opens on demand.
 */
export function RunActions(props: Props) {
  const { status } = props;
  const [rejecting, setRejecting] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    runAction,
    {
      error: null,
    },
  );
  const awaiting =
    status === "awaiting_plan_approval" || status === "awaiting_final_approval";
  const approve =
    status === "awaiting_plan_approval" ? "approve_plan" : "approve_final";
  const turn = awaiting || status === "blocked";
  const ask =
    status === "awaiting_plan_approval"
      ? `Te toca: aprobar el plan (revisión ${props.planRevision})`
      : status === "awaiting_final_approval"
        ? `Te toca: aprobar la vista previa${props.headSha ? ` (${props.headSha.slice(0, 7)})` : ""}`
        : status === "blocked"
          ? "Te toca: el run está bloqueado"
          : "Decisión";

  return (
    <>
      <section
        className={`card stack run-actions${turn ? " run-actions-turn" : ""}`}
        data-testid="run-actions"
        data-turn={turn}
      >
        <h2>{ask}</h2>
        {awaiting && (
          <form action={action} className="stack">
            <Hidden {...props} />
            <div className="row">
              <button
                type="submit"
                name="action"
                value={approve}
                disabled={pending}
                data-testid="approve-button"
              >
                {status === "awaiting_plan_approval"
                  ? "Aprobar plan"
                  : "Aprobar y fusionar"}
              </button>
              {rejecting ? (
                <>
                  <button
                    type="submit"
                    name="action"
                    value="reject"
                    className="secondary"
                    disabled={pending}
                    data-testid="reject-button"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setRejecting(false)}
                  >
                    Cerrar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRejecting(true)}
                  data-testid="reject-open"
                >
                  Rechazar…
                </button>
              )}
            </div>
            {rejecting && (
              <label className="field">
                Feedback (vuelve a planificar sobre la misma rama; sin feedback,
                rechaza el run)
                <textarea
                  name="feedback"
                  rows={2}
                  maxLength={2000}
                  autoFocus
                  data-testid="feedback-input"
                />
              </label>
            )}
          </form>
        )}
        {status === "blocked" && (
          <form action={action} className="row">
            <Hidden {...props} />
            <button
              type="submit"
              name="action"
              value="retry"
              disabled={pending}
              data-testid="retry-button"
            >
              Reintentar
            </button>
            <button
              type="submit"
              name="action"
              value="cancel"
              className="secondary"
              disabled={pending}
              data-testid="abandon-button"
            >
              Abandonar
            </button>
          </form>
        )}
        {!awaiting && status !== "blocked" && (
          <form action={action} className="row">
            <Hidden {...props} />
            <button
              type="submit"
              name="action"
              value="cancel"
              className="secondary"
              disabled={pending}
              data-testid="cancel-button"
            >
              Cancelar run
            </button>
            <span className="muted">
              Los agentes trabajan; no hace falta hacer nada.
            </span>
          </form>
        )}
        {state.notice && (
          <p className="notice" role="status" data-testid="action-notice">
            {state.notice}
          </p>
        )}
        {state.error && (
          <p className="error" data-testid="action-error">
            {state.error}
          </p>
        )}
      </section>
    </>
  );
}
