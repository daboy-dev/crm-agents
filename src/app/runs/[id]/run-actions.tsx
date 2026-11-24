"use client";

import { useActionState } from "react";
import { runAction, type FormState } from "../actions";

type Props = { runId: number; version: number; status: string };

function Hidden({ runId, version }: { runId: number; version: number }) {
  return (
    <>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="version" value={version} />
    </>
  );
}

/** Buttons for the human (D9). Each form carries the run version (D22). */
export function RunActions({ runId, version, status }: Props) {
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

  return (
    <section className="card stack" data-testid="run-actions">
      <h2>Decisión</h2>
      {awaiting && (
        <form action={action} className="stack">
          <Hidden runId={runId} version={version} />
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
          </div>
          <label className="field">
            Feedback (vuelve a planificar sobre la misma rama; sin feedback,
            rechaza el run)
            <textarea
              name="feedback"
              rows={2}
              maxLength={2000}
              data-testid="feedback-input"
            />
          </label>
          <div className="row">
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
          </div>
        </form>
      )}
      {status === "blocked" && (
        <form action={action} className="row">
          <Hidden runId={runId} version={version} />
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
          <Hidden runId={runId} version={version} />
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
      {state.error && (
        <p className="error" data-testid="action-error">
          {state.error}
        </p>
      )}
    </section>
  );
}
