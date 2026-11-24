"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: null, user: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="stack" data-testid="login-form">
      <label className="field">
        <span>Usuario</span>
        <input
          name="user"
          autoComplete="username"
          defaultValue={state.user}
          required
          data-testid="field-user"
        />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="field-password"
        />
      </label>
      {state.error && (
        <p role="alert" className="error" data-testid="login-error">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} data-testid="login-submit">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
