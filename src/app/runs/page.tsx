import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Nav } from "@/app/nav";
import { getDb } from "@/server/db/client";
import { providersForNewRun } from "@/server/llm";
import { isFinal, type RunStatus } from "@/server/runs/machine";
import {
  doneRequests,
  listRuns,
  runsCreatedToday,
  type RunListItem,
} from "@/server/runs/queries";
import { demoRequests } from "@/server/runs/demo-requests";
import { runsPerDay } from "@/server/runs/limits";
import { readQuotaStatus, type AgentQuota } from "@/server/llm/quota-status";
import { CRM_URL, DEMO_REPO, PANEL_REPO } from "@/server/github/config";
import { RUN_STATUS, statusTone } from "./labels";
import { NewRunForm } from "./new-run-form";
import { RunPoller } from "./run-poller";

export const metadata: Metadata = { title: "Runs · crm-agents" };

function RunRow({ run, position }: { run: RunListItem; position?: number }) {
  return (
    <li
      className="run-row"
      data-testid="run-row"
      data-run={run.id}
      data-status={run.status}
    >
      <Link href={`/runs/${run.id}`}>Run #{run.id}</Link>
      <span className={`badge badge-${statusTone(run.status)}`}>
        {position !== undefined
          ? `${position}.º en la cola`
          : (RUN_STATUS[run.status] ?? run.status)}
      </span>
      <span className="run-request">{run.request}</span>
      {run.scenario && <code>{run.scenario}</code>}
    </li>
  );
}

function Section({
  title,
  runs,
  testId,
  empty,
  numbered = false,
}: {
  title: string;
  runs: RunListItem[];
  testId: string;
  empty: string;
  /** The queue shows the position of each request (D48). */
  numbered?: boolean;
}) {
  return (
    <section className="card" data-testid={testId}>
      <h2>{title}</h2>
      {runs.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="run-list">
          {runs.map((r, i) => (
            <RunRow
              key={r.id}
              run={r}
              position={numbered ? i + 1 : undefined}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

async function RunLists() {
  await connection();
  const all = await listRuns(getDb());
  const active = all.filter(
    (r) => r.status !== "queued" && !isFinal(r.status as RunStatus),
  );
  const queue = all.filter((r) => r.status === "queued").reverse();
  const recent = all.filter((r) => isFinal(r.status as RunStatus));
  return (
    <>
      <Section
        title="Activo"
        runs={active}
        testId="active-runs"
        empty="Ningún run activo."
      />
      <Section
        title="En cola"
        runs={queue}
        numbered
        testId="queued-runs"
        empty="La cola está vacía."
      />
      <Section
        title="Terminados"
        runs={recent}
        testId="recent-runs"
        empty="Todavía no hay runs terminados."
      />
    </>
  );
}

const ACTOR_NAMES: Record<string, string> = {
  orchestrator: "el Orquestador",
  develop: "Develop",
  testing: "Testing",
};

const list = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

/** Warning when Gemini's free quota is gone until 9:00 (D26, D37, D48). */
function quotaWarning(status: AgentQuota[]): string | null {
  const names = (q: AgentQuota[]) => list(q.map((x) => ACTOR_NAMES[x.agent]!));
  const none = status.filter((q) => q.next === null);
  if (none.length > 0) {
    return `Sin modelos disponibles para ${names(none)} hasta las 9:00 (hora de Madrid): los runs esperarán.`;
  }
  const paid = status.filter((q) => q.paid);
  if (paid.length > 0) {
    return `La cuota gratuita de Gemini está agotada hasta las 9:00 (hora de Madrid): ${names(paid)} ${paid.length > 1 ? "usan" : "usa"} el respaldo de pago (Claude).`;
  }
  if (status.some((q) => q.geminiExhausted)) {
    return "Algún modelo de Gemini ha agotado su cuota hasta las 9:00 (hora de Madrid): se usan los siguientes de la cadena.";
  }
  return null;
}

async function Form() {
  await connection();
  const db = getDb();
  const providers = providersForNewRun();
  const real = (["orchestrator", "develop", "testing"] as const).filter(
    (a) => providers[a] !== "mock",
  );
  const [done, today, quota] = await Promise.all([
    doneRequests(db),
    runsCreatedToday(db),
    readQuotaStatus(db, real),
  ]);
  return (
    <NewRunForm
      providers={providers}
      suggestions={demoRequests(done)}
      limits={{
        perDay: runsPerDay(),
        left: Math.max(0, runsPerDay() - today),
        quota: quotaWarning(quota),
      }}
    />
  );
}

/** How it works, for the evaluators (D48). */
function Intro() {
  return (
    <section className="card stack intro" data-testid="intro">
      <p>
        Pide un cambio para el CRM en lenguaje natural. El{" "}
        <strong>Orquestador</strong> lo convierte en un plan que{" "}
        <strong>apruebas tú</strong>; <strong>Develop</strong> escribe el código
        en una rama de crm-demo y <strong>Testing</strong> lo comprueba en su
        vista previa, y los dos iteran hasta que pasa. Al final apruebas la
        vista previa y el PR se fusiona.
      </p>
      <ol className="flow" aria-label="Flujo de un run">
        <li>Petición</li>
        <li>Plan · lo apruebas</li>
        <li>Develop ⇄ Testing</li>
        <li>Vista previa · la apruebas</li>
        <li>Merge</li>
      </ol>
      <p className="row">
        <a href={CRM_URL} target="_blank" rel="noreferrer">
          CRM en producción ↗
        </a>
        <a
          href={`https://github.com/${DEMO_REPO}`}
          target="_blank"
          rel="noreferrer"
        >
          Repo de crm-demo ↗
        </a>
        <a
          href={`https://github.com/${PANEL_REPO}`}
          target="_blank"
          rel="noreferrer"
        >
          Repo de este panel ↗
        </a>
      </p>
    </section>
  );
}

export default function RunsPage() {
  return (
    <main className="page stack">
      <Nav title="Runs" />
      <Intro />
      <p className="muted">
        Un run a la vez; los demás esperan en cola. Se actualiza sola cada 5 s.
      </p>
      <RunPoller />
      <Suspense fallback={null}>
        <Form />
      </Suspense>
      <Suspense fallback={<p className="muted">Cargando…</p>}>
        <RunLists />
      </Suspense>
    </main>
  );
}
