"use client";

import { useActionState } from "react";
import { createRun, type FormState } from "./actions";
import { SCENARIO } from "./labels";

export function NewRunForm({ provider }: { provider: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createRun,
    {
      error: null,
    },
  );
  return (
    <form action={action} className="card stack" data-testid="new-run-form">
      <h2>Petición nueva</h2>
      <label className="field">
        Qué quieres cambiar en el CRM
        <textarea
          name="request"
          rows={3}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Por ejemplo: añade el NIF a los clientes"
          data-testid="request-input"
        />
      </label>
      {provider === "mock" && (
        <div className="row">
          <label className="field">
            Escenario de MockProvider
            <select
              name="scenario"
              defaultValue="ok"
              data-testid="scenario-select"
            >
              {Object.entries(SCENARIO).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulateCrash"
              data-testid="crash-checkbox"
            />
            Simular caída tras el commit
          </label>
        </div>
      )}
      {state.error && <p className="error">{state.error}</p>}
      <div className="row">
        <button
          type="submit"
          disabled={pending}
          data-testid="create-run-button"
        >
          {pending ? "Creando…" : "Crear run"}
        </button>
        <span className="muted">Proveedor: {provider}</span>
      </div>
    </form>
  );
}
