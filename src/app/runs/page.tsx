import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Nav } from "@/app/nav";
import { getDb } from "@/server/db/client";
import { providersForNewRun } from "@/server/llm";
import { isFinal, type RunStatus } from "@/server/runs/machine";
import { listRuns, type RunListItem } from "@/server/runs/queries";
import { RUN_STATUS, statusTone } from "./labels";
import { NewRunForm } from "./new-run-form";
import { RunPoller } from "./run-poller";

export const metadata: Metadata = { title: "Runs · crm-agents" };

function RunRow({ run }: { run: RunListItem }) {
  return (
    <li
      className="run-row"
      data-testid="run-row"
      data-run={run.id}
      data-status={run.status}
    >
      <Link href={`/runs/${run.id}`}>Run #{run.id}</Link>
      <span className={`badge badge-${statusTone(run.status)}`}>
        {RUN_STATUS[run.status] ?? run.status}
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
}: {
  title: string;
  runs: RunListItem[];
  testId: string;
  empty: string;
}) {
  return (
    <section className="card" data-testid={testId}>
      <h2>{title}</h2>
      {runs.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="run-list">
          {runs.map((r) => (
            <RunRow key={r.id} run={r} />
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

async function Form() {
  await connection();
  return <NewRunForm providers={providersForNewRun()} />;
}

export default function RunsPage() {
  return (
    <main className="page stack">
      <Nav title="Runs" />
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
