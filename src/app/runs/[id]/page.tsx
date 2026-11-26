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
import { ACTOR, RUN_STATUS, SCENARIO, statusTone } from "../labels";
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
import { Tasks } from "./tasks";
import { taskSection, type TaskSection } from "@/server/runs/task-view";
import { PreviewPanel } from "./preview-panel";
import { parseTab, runHref, TABS, type TabId } from "./view-params";
import {
  FILTERS,
  parseFilter,
  timelineItems,
  type FilterId,
} from "@/server/runs/timeline";

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
    </section>
  );
}

/** Tasks with their criteria and results (D43). */
function sectionOf(detail: RunDetail): TaskSection | null {
  const { run, tasks } = detail;
  if (tasks.length === 0 || run.status === "planning") return null;
  return taskSection({
    runId: run.id,
    planRevision: run.planRevision,
    tasks,
    titles: detail.taskTitles,
    events: detail.events,
    steps: detail.criteriaSteps,
    report: detail.report,
  });
}

function TaskList({
  detail,
  section,
}: {
  detail: RunDetail;
  section: TaskSection;
}) {
  const { tasks } = detail;
  const contexts = lastContexts(detail);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return (
    <Tasks
      section={section}
      commitUrl={commitUrl}
      extra={(taskId) => {
        const task = byId.get(taskId);
        const context = contexts.get(taskId);
        return (
          <>
            {task && task.references.length > 0 && (
              <p className="files" data-testid="task-references">
                <span className="muted">Referencias:</span>
                {task.references.map((f) => (
                  <code key={f}>{f}</code>
                ))}
              </p>
            )}
            {context && (
              <details>
                <summary>
                  Archivos leídos por Develop ({context.files.length})
                </summary>
                <ContextFiles context={context} />
              </details>
            )}
          </>
        );
      }}
    />
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

const RETRY_LABEL: Record<string, string> = {
  overloaded: "Modelo saturado",
  rate_limited: "Límite por minuto",
};

function TimelineEvent({ e }: { e: RunDetail["events"][number] }) {
  return (
    <li data-testid="run-event" data-actor={e.actor} data-kind={e.kind}>
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
  );
}

/** Filterable by agent, retries grouped, one separator per round (D44). */
function Timeline({
  detail,
  filter,
  tab,
}: {
  detail: RunDetail;
  filter: FilterId;
  tab: TabId;
}) {
  const items = timelineItems(detail.events, filter);
  const minutes = (at: Date) =>
    Math.max(0, Math.round((detail.loadedAt - at.getTime()) / 60_000));
  return (
    <section className="card stack" data-testid="run-timeline">
      <h2>Línea de tiempo</h2>
      <nav className="filters" aria-label="Filtrar por agente">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={runHref(detail.run.id, {
              agente: f.id,
              tab,
              status: detail.run.status,
            })}
            scroll={false}
            replace
            className={f.id === filter ? "filter filter-on" : "filter"}
            aria-current={f.id === filter ? "true" : undefined}
            data-testid="timeline-filter"
            data-filter={f.id}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {items.length === 0 && (
        <p className="muted">Ningún evento de este agente todavía.</p>
      )}
      <ol className="timeline">
        {items.map((item) => {
          if (item.kind === "event") {
            return <TimelineEvent key={item.event.id} e={item.event} />;
          }
          if (item.kind === "iteration") {
            return (
              <li
                key={`it-${item.revision}-${item.iteration}`}
                className="timeline-round"
                data-testid="timeline-round"
              >
                Iteración {item.iteration}
                {item.revision > 1 && ` · revisión ${item.revision}`}
              </li>
            );
          }
          const kind = item.events[0]!.kind;
          return (
            <li
              key={`retries-${item.events[0]!.id}`}
              className="timeline-retries"
              data-testid="timeline-retries"
              data-kind={kind}
              data-count={item.events.length}
            >
              <details>
                <summary>
                  <span className="muted">{time.format(item.first)}</span>{" "}
                  {RETRY_LABEL[kind] ?? kind} ×{item.events.length} · hace{" "}
                  {minutes(item.last)} min
                </summary>
                <ol className="timeline">
                  {item.events.map((e) => (
                    <TimelineEvent key={e.id} e={e} />
                  ))}
                </ol>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

async function RunView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const id = Number((await params).id);
  const query = await searchParams;
  const filter = parseFilter(query.agente);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getRunDetail(getDb(), id);
  if (!detail) notFound();
  const { run } = detail;
  const final = isFinal(run.status as RunStatus);
  const tab = parseTab(query.tab, run.status);
  const section = sectionOf(detail);
  const approving = run.status === "awaiting_final_approval";
  return (
    <>
      <Nav title={`Run #${run.id}`} />
      <AgentCards
        cards={agentCards({
          run: { ...run, status: run.status as RunStatus },
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
          runId={run.id}
          status={run.status}
          planRevision={run.planRevision}
          headSha={run.headSha}
        />
      )}
      {/* D46: tabs on mobile, two columns on desktop. */}
      <nav className="run-tabs" aria-label="Secciones del run">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={runHref(run.id, {
              agente: filter,
              tab: t.id,
              status: run.status,
            })}
            scroll={false}
            replace
            className={t.id === tab ? "run-tab run-tab-on" : "run-tab"}
            aria-current={t.id === tab ? "page" : undefined}
            data-testid="run-tab"
            data-tab={t.id}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="run-layout" data-tab={tab}>
        <div className="run-main">
          <div
            className={`run-panel run-panel-preview${approving ? "" : " desktop-hidden"}`}
          >
            <PreviewPanel
              headSha={run.headSha}
              preview={detail.preview}
              report={detail.report}
              section={section}
              shots={detail.screenshots}
              awaitingApproval={approving}
            />
          </div>
          <div className="run-panel run-panel-tasks stack">
            <Plan detail={detail} />
            {section && <TaskList detail={detail} section={section} />}
            <Context detail={detail} />
          </div>
        </div>
        <div className="run-panel run-panel-linea">
          <Timeline detail={detail} filter={filter} tab={tab} />
        </div>
      </div>
    </>
  );
}

export default function RunPage({
  params,
  searchParams,
}: PageProps<"/runs/[id]">) {
  return (
    <main className="page page-wide stack">
      <RunPoller />
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <RunView params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
