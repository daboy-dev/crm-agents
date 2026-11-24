import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión · crm-agents" };

export default function LoginPage() {
  return (
    <main className="login">
      <h1>crm-agents</h1>
      <p className="muted">Inicia sesión con el usuario de demo.</p>
      <LoginForm />
    </main>
  );
}
