"use client";

import { useActionState, useRef } from "react";
import type { AgentProviders } from "@/server/llm";
import type { DemoRequest } from "@/server/runs/demo-requests";
import { createRun, type FormState } from "./actions";
import { ACTOR, SCENARIO } from "./labels";

export type Limits = {
  perDay: number;
  left: number;
  /** Warning about the LLM quota (D48), or null. */
  quota: string | null;
};

type Props = {
  providers: AgentProviders;
  suggestions: (DemoRequest & { merged: boolean })[];
  limits: Limits;
};

/**
 * New request (D25). The suggestions fill the field without sending it, and
 * the simulations of H3 to H6 stay folded (D48).
 */
export function NewRunForm({ providers, suggestions, limits }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const fill = (text: string) => {
    if (!input.current) return;
    input.current.value = text;
    input.current.focus();
  };
  // Same rule as usesMockScenario(), which is server-only.
  const mockScenario =
    providers.develop === "mock" || providers.testing === "mock";
  const [state, action, pending] = useActionState<FormState, FormData>(
    createRun,
    {
      error: null,
    },
  );
  return (
    <form action={action} className="card stack" data-testid="new-run-form">
      <h2>Petición nueva</h2>
      {suggestions.length > 0 && (
        <div className="stack suggestions">
          <span className="muted">
            Peticiones sugeridas (rellenan el campo):
          </span>
          <div className="row">
            {suggestions.map((d) => (
              <button
                key={d.label}
                type="button"
                className="secondary suggestion"
                onClick={() => fill(d.request)}
                title={d.request}
                data-testid="suggestion"
                data-merged={d.merged}
              >
                <strong>{d.label}</strong>
                <span className="muted">
                  {d.merged ? "ya fusionada" : d.covers}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="field">
        Qué quieres cambiar en el CRM
        <textarea
          name="request"
          rows={3}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Por ejemplo: añade el NIF a los clientes"
          ref={input}
          data-testid="request-input"
        />
      </label>
      <details className="advanced" data-testid="advanced-options">
        <summary>Opciones avanzadas: simulaciones de fallos (H3 a H6)</summary>
        <div className="row">
          {mockScenario && (
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
          )}
          <label className="check">
            <input
              type="checkbox"
              name="simulateCrash"
              data-testid="crash-checkbox"
            />
            Simular caída tras el commit
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulatePlanCrash"
              data-testid="plan-crash-checkbox"
            />
            Simular caída tras planificar
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulateTypeError"
              data-testid="type-error-checkbox"
            />
            Simular error de tipos
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulateMaxTokens"
              data-testid="max-tokens-checkbox"
            />
            Simular MAX_TOKENS
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulateCriterionFail"
              data-testid="criterion-fail-checkbox"
            />
            Simular fallo de criterio
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="simulatePersistentFail"
              data-testid="persistent-fail-checkbox"
            />
            Simular fallo persistente
          </label>
        </div>
      </details>
      {limits.quota && (
        <p className="notice" data-testid="quota-warning">
          {limits.quota}
        </p>
      )}
      {state.error && <p className="error">{state.error}</p>}
      <div className="row">
        <button
          type="submit"
          disabled={pending || limits.left <= 0}
          data-testid="create-run-button"
        >
          {pending ? "Creando…" : "Crear run"}
        </button>
        <span data-testid="runs-left">
          {limits.left > 0
            ? `Quedan ${limits.left} de ${limits.perDay} runs hoy`
            : `Se han usado los ${limits.perDay} runs de hoy`}
        </span>
        <span className="muted" data-testid="providers">
          {Object.entries(providers)
            .map(([agent, name]) => `${ACTOR[agent] ?? agent}: ${name}`)
            .join(" · ")}
        </span>
      </div>
    </form>
  );
}
