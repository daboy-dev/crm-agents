import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Nav } from "@/app/nav";
import { getDb } from "@/server/db/client";
import { runProviders } from "@/server/llm";
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
import {
  Calls,
  contextData,
  ContextFiles,
  EventDetails,
  type ContextData,
} from "./event-details";
import { agentCards } from "@/server/runs/agent-cards";
import { AgentCards } from "./agent-cards";
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

const fileUrl = (sha: string, path: string) =>
  `https://github.com/${DEMO_REPO}/blob/${sha}/${path}`;

const CRITERION_TYPE: Record<string, string> = {
  e2e: "E2E",
  visual: "Visual",
};

/** Last files Develop read for each task (D32). */
function lastContexts(detail: RunDetail): Map<number, ContextData> {
  const byTask = new Map<number, ContextData>();
  for (const e of detail.events) {
    if (e.kind !== "context") continue;
    const context = contextData(e.data);
    if (context.taskId !== undefined) byTask.set(context.taskId, context);
  }
  return byTask;
}

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
        <span className="muted" data-testid="run-providers">
          {Object.entries(runProviders(run))
            .map(([agent, name]) => `${ACTOR[agent] ?? agent}: ${name}`)
            .join(" · ")}
        </span>
        {run.scenario && <code>{SCENARIO[run.scenario] ?? run.scenario}</code>}
        {run.simulateCrash && (
          <code>caída simulada{run.crashedAt ? " (hecha)" : ""}</code>
        )}
        {run.simulateTypeError && <code>error de tipos simulado</code>}
        {run.simulateMaxTokens && (
          <code>
            MAX_TOKENS simulado{run.maxTokensSimulatedAt ? " (hecho)" : ""}
          </code>
        )}
        {run.simulatePersistentFail ? (
          <code>fallo persistente simulado</code>
        ) : (
          run.simulateCriterionFail && <code>fallo de criterio simulado</code>
        )}
      </p>
      <p className="run-request">{run.request}</p>
      {run.blockedReason && run.status === "blocked" && (
        <p className="error">{run.blockedReason}</p>
      )}
      {run.rejectedReason && run.status === "rejected" && (
        <p className="error" data-testid="rejection-reason">
          El Orquestador no puede hacer esta petición: {run.rejectedReason}
        </p>
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
      <p className="muted" data-testid="llm-calls">
        Plan revisión {run.planRevision} · {run.llmCalls} llamadas al LLM
      </p>
    </section>
  );
}

function Plan({ detail }: { detail: RunDetail }) {
  const { run, tasks } = detail;
  const contexts = lastContexts(detail);
  if (run.status === "planning") {
    // The stored summary still belongs to the previous revision.
    return (
      <section className="card" data-testid="run-plan">
        <h2>Plan · revisión {run.planRevision}</h2>
        <p className="muted">
          El Orquestador está preparando la revisión {run.planRevision}.
        </p>
      </section>
    );
  }
  if (!run.planSummary && tasks.length === 0) return null;
  const assumptions = run.planAssumptions ?? [];
  return (
    <section className="card stack" data-testid="run-plan">
      <h2>Plan · revisión {run.planRevision}</h2>
      {run.planSummary && <p data-testid="plan-summary">{run.planSummary}</p>}
      {assumptions.length > 0 && (
        <div>
          <strong>Supuestos</strong>
          <ul data-testid="plan-assumptions">
            {assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {tasks.length > 0 && (
        <ol className="task-list" data-testid="run-tasks">
          {tasks.map((t) => (
            <li
              key={t.id}
              data-testid="task"
              data-status={t.status}
              data-iteration={t.iteration}
            >
              <p className="row">
                <strong>
                  {t.position}. {t.title}
                </strong>
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
              {t.splitFrom !== null && (
                <p className="muted" data-testid="task-split-from">
                  Subtarea: sale de dividir una tarea cuya respuesta no cabía.
                </p>
              )}
              <p className="muted">{t.description}</p>
              {t.files.length > 0 && (
                <p className="files" data-testid="task-files">
                  {t.files.map((f) => (
                    <code key={f}>{f}</code>
                  ))}
                </p>
              )}
              {t.references.length > 0 && (
                <p className="files" data-testid="task-references">
                  <span className="muted">Referencias:</span>
                  {t.references.map((f) => (
                    <code key={f}>{f}</code>
                  ))}
                </p>
              )}
              {contexts.has(t.id) && (
                <details>
                  <summary>
                    Archivos leídos por Develop (
                    {contexts.get(t.id)!.files.length})
                  </summary>
                  <ContextFiles context={contexts.get(t.id)!} />
                </details>
              )}
              <ul className="criteria">
                {t.acceptanceCriteria.map((c) => (
                  <li key={c.id} data-testid="criterion" data-type={c.type}>
                    <span
                      className={`badge badge-${c.type === "e2e" ? "info" : "neutral"}`}
                    >
                      {c.id} · {CRITERION_TYPE[c.type] ?? c.type}
                    </span>{" "}
                    {c.text}
                    {c.testIds?.length > 0 && (
                      <>
                        {" "}
                        <span
                          className="muted"
                          data-testid="criterion-test-ids"
                        >
                          {c.testIds.map((id) => (
                            <code key={id}>{id}</code>
                          ))}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {t.lastFeedback && <p className="error">{t.lastFeedback}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** What the orchestrator read from crm-demo (D27). */
function Context({ detail }: { detail: RunDetail }) {
  const { run } = detail;
  if (!run.baseSha) return null;
  const paths = run.contextPaths ?? [];
  return (
    <section className="card" data-testid="run-context">
      <h2>Archivos leídos por el Orquestador</h2>
      <p className="muted">
        crm-demo en{" "}
        <a href={commitUrl(run.baseSha)} target="_blank" rel="noreferrer">
          <code>{run.baseSha.slice(0, 7)}</code>
        </a>{" "}
        (base de la rama {runBranch(run.id)}), además del árbol de rutas del
        repositorio.
      </p>
      <ul data-testid="context-files">
        {paths.map((p) => (
          <li key={p}>
            <a href={fileUrl(run.baseSha!, p)} target="_blank" rel="noreferrer">
              <code>{p}</code>
            </a>
          </li>
        ))}
      </ul>
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
            <span>
              {e.message}
              <EventDetails kind={e.kind} data={e.data} />
              <Calls data={e.data} />
            </span>
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
      <AgentCards
        cards={agentCards({
          run: {
            ...detail.run,
            status: detail.run.status as RunStatus,
          },
          tasks: detail.tasks,
          steps: detail.steps,
          events: detail.events,
          deployState: detail.preview?.deployState,
        })}
        now={detail.loadedAt}
      />
      <Summary detail={detail} />
      {!final && (
        <RunActions
          runId={detail.run.id}
          status={detail.run.status}
          planRevision={detail.run.planRevision}
          headSha={detail.run.headSha}
        />
      )}
      <Plan detail={detail} />
      <Context detail={detail} />
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
