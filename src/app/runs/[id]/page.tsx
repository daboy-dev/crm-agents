import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Nav } from "@/app/nav";
import { getDb } from "@/server/db/client";
import { DEMO_REPO, runBranch } from "@/server/github/config";
import { isFinal, type RunStatus } from "@/server/runs/machine";
import { getRunDetail, type RunDetail } from "@/server/runs/queries";
import {
  ACTOR,
  RUN_STATUS,
  SCENARIO,
  statusTone,
  TASK_STATUS,
} from "../labels";
import { RunPoller } from "../run-poller";
import { RunActions } from "./run-actions";

export const metadata: Metadata = { title: "Run · crm-agents" };

const time = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Madrid",
});

const commitUrl = (sha: string) =>
  `https://github.com/${DEMO_REPO}/commit/${sha}`;

function Summary({ detail }: { detail: RunDetail }) {
  const { run, preview, report } = detail;
  return (
    <section className="card stack" data-testid="run-summary">
      <p className="row">
        <span
          className={`badge badge-${statusTone(run.status)}`}
          data-testid="run-status"
          data-status={run.status}
        >
          {RUN_STATUS[run.status] ?? run.status}
        </span>
        <span className="muted">versión {run.version}</span>
        {run.scenario && <code>{SCENARIO[run.scenario] ?? run.scenario}</code>}
        {run.simulateCrash && (
          <code>caída simulada{run.crashedAt ? " (hecha)" : ""}</code>
        )}
      </p>
      <p className="run-request">{run.request}</p>
      {run.blockedReason && run.status === "blocked" && (
        <p className="error">{run.blockedReason}</p>
      )}
      <p className="row">
        {(run.headSha || run.prNumber) && <code>{runBranch(run.id)}</code>}
        {run.prUrl && (
          <a
            href={run.prUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="pr-link"
          >
            PR #{run.prNumber}
          </a>
        )}
        {run.headSha && (
          <a href={commitUrl(run.headSha)} target="_blank" rel="noreferrer">
            <code>{run.headSha.slice(0, 7)}</code>
          </a>
        )}
        {preview?.previewUrl && preview.deployState === "success" && (
          <a
            href={preview.previewUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="preview-link"
          >
            Abrir vista previa
          </a>
        )}
        {preview && !report && (
          <span className="muted">
            Vista previa: {preview.deployState ?? "sin datos"}
          </span>
        )}
        {report && (
          <span data-testid="run-report">
            E2E: {report.passed} pasan · {report.failed} fallan ·{" "}
            <a href={report.runUrl} target="_blank" rel="noreferrer">
              ejecución
            </a>{" "}
            · <Link href="/pipeline">capturas</Link>
          </span>
        )}
      </p>
      <p className="muted">
        Plan revisión {run.planRevision} · {run.llmCalls} llamadas al LLM
      </p>
      {run.planSummary && <p>{run.planSummary}</p>}
    </section>
  );
}

function Tasks({ detail }: { detail: RunDetail }) {
  if (detail.tasks.length === 0) return null;
  return (
    <section className="card" data-testid="run-tasks">
      <h2>Tareas</h2>
      <ol className="task-list">
        {detail.tasks.map((t) => (
          <li
            key={t.id}
            data-testid="task"
            data-status={t.status}
            data-iteration={t.iteration}
          >
            <p className="row">
              <strong>{t.title}</strong>
              <span className={`badge badge-${statusTone(t.status)}`}>
                {TASK_STATUS[t.status] ?? t.status}
              </span>
              <span className="muted">
                iteración {t.iteration} de {t.maxIterations}
              </span>
              {t.commitSha && (
                <a
                  href={commitUrl(t.commitSha)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <code>{t.commitSha.slice(0, 7)}</code>
                </a>
              )}
            </p>
            <p className="muted">{t.description}</p>
            <ul>
              {t.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            {t.lastFeedback && <p className="error">{t.lastFeedback}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Timeline({ detail }: { detail: RunDetail }) {
  return (
    <section className="card" data-testid="run-timeline">
      <h2>Línea de tiempo</h2>
      <ol className="timeline">
        {detail.events.map((e) => (
          <li
            key={e.id}
            data-testid="run-event"
            data-actor={e.actor}
            data-kind={e.kind}
          >
            <span className="muted">{time.format(e.at)}</span>
            <span className={`actor actor-${e.actor}`}>
              {ACTOR[e.actor] ?? e.actor}
            </span>
            <span>{e.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function RunView({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getRunDetail(getDb(), id);
  if (!detail) notFound();
  const final = isFinal(detail.run.status as RunStatus);
  return (
    <>
      <Nav title={`Run #${detail.run.id}`} />
      <Summary detail={detail} />
      {!final && (
        <RunActions
          runId={detail.run.id}
          version={detail.run.version}
          status={detail.run.status}
        />
      )}
      <Tasks detail={detail} />
      <Timeline detail={detail} />
    </>
  );
}

export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  return (
    <main className="page stack">
      <RunPoller />
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <RunView params={params} />
      </Suspense>
    </main>
  );
}
