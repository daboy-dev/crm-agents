import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/app/login/actions";
import { getDb } from "@/server/db/client";
import { getPendingEvents, getPipeline } from "@/server/pipeline/queries";
import { reprocessEvents } from "./actions";
import { AutoRefresh } from "./auto-refresh";
import { PrCard } from "./pr-card";

export const metadata: Metadata = { title: "Pipeline · crm-agents" };

async function PendingEvents() {
  await connection();
  const { pending, lastError } = await getPendingEvents(getDb());
  return (
    <form action={reprocessEvents} className="pending row">
      <span data-testid="pending-events">
        Eventos pendientes: <strong>{pending}</strong>
      </span>
      <button
        type="submit"
        className="secondary"
        data-testid="reprocess-button"
      >
        Reprocesar
      </button>
      {lastError && <span className="error">{lastError}</span>}
    </form>
  );
}

async function PullRequests() {
  await connection();
  const prs = await getPipeline(getDb());
  if (prs.length === 0) {
    return (
      <p className="muted" data-testid="pipeline-empty">
        Todavía no hay PRs de crm-demo con vista previa.
      </p>
    );
  }
  return (
    <div className="stack" data-testid="pipeline-list">
      {prs.map((pr) => (
        <PrCard key={pr.number} pr={pr} />
      ))}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Pipeline</h1>
        <form action={logout}>
          <button
            type="submit"
            className="secondary"
            data-testid="logout-button"
          >
            Salir
          </button>
        </form>
      </header>
      <p className="muted">
        Vista previa, tests E2E y capturas de cada PR de crm-demo. Se actualiza
        sola cada 5 s.
      </p>
      <AutoRefresh intervalMs={5000} />
      <Suspense fallback={null}>
        <PendingEvents />
      </Suspense>
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <PullRequests />
      </Suspense>
    </main>
  );
}
