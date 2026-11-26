import { DEMO_REPO } from "@/server/github/config";
import type {
  PipelineCommit,
  PipelinePr,
  PipelineReport,
} from "@/server/pipeline/queries";
import { Screenshots } from "@/app/screenshots";

const PR_STATE: Record<string, string> = {
  open: "Abierto",
  closed: "Cerrado",
  merged: "Fusionado",
};

const DEPLOY_STATE: Record<string, string> = {
  pending: "Desplegando",
  queued: "En cola",
  in_progress: "Desplegando",
  success: "Lista",
  failure: "Fallo",
  error: "Error",
};

const REPORT_STATE: Record<string, string> = {
  passed: "Tests en verde",
  failed: "Tests con fallos",
  cancelled: "Cancelado",
  error: "Error al leer resultados",
};

function tone(state: string | null | undefined): string {
  switch (state) {
    case "success":
    case "passed":
    case "open":
      return "ok";
    case "failure":
    case "error":
    case "failed":
      return "bad";
    case "merged":
      return "info";
    default:
      return "neutral";
  }
}

function Badge({
  state,
  labels,
  testId,
}: {
  state: string | null | undefined;
  labels: Record<string, string>;
  testId: string;
}) {
  return (
    <span
      className={`badge badge-${tone(state)}`}
      data-testid={testId}
      data-state={state ?? ""}
    >
      {(state && labels[state]) ?? "Sin datos"}
    </span>
  );
}

function TestReport({ report }: { report: PipelineReport | null }) {
  if (!report) {
    return (
      <p className="muted" data-testid="report-pending">
        Sin resultados de tests todavía.
      </p>
    );
  }
  return (
    <div className="report" data-testid="test-report">
      <p className="row">
        <Badge
          state={report.status}
          labels={REPORT_STATE}
          testId="report-status"
        />
        <span data-testid="report-counts">
          {report.passed} pasados · {report.failed} fallidos
          {report.flaky > 0 && ` · ${report.flaky} inestables`}
          {report.skipped > 0 && ` · ${report.skipped} saltados`}
        </span>
        <a href={report.runUrl} target="_blank" rel="noreferrer">
          Ver ejecución
        </a>
      </p>
      {report.error && <p className="error">{report.error}</p>}
      {report.failures.length > 0 && (
        <ul className="failures" data-testid="report-failures">
          {report.failures.map((f, i) => (
            <li key={i}>
              <strong>{f.title}</strong>
              {f.project && <span className="muted"> · {f.project}</span>}
              {f.error && <pre>{f.error}</pre>}
            </li>
          ))}
        </ul>
      )}
      <Screenshots shots={report.screenshots} />
    </div>
  );
}

function Commit({ commit }: { commit: PipelineCommit }) {
  return (
    <>
      <p className="row">
        <code title={commit.sha}>{commit.sha.slice(0, 7)}</code>
        <Badge
          state={commit.deployState}
          labels={DEPLOY_STATE}
          testId="deploy-status"
        />
        {commit.previewUrl && commit.deployState === "success" && (
          <a
            href={commit.previewUrl}
            target="_blank"
            rel="noreferrer"
            data-testid="preview-link"
          >
            Abrir vista previa
          </a>
        )}
      </p>
      <TestReport report={commit.report} />
    </>
  );
}

export function PrCard({ pr }: { pr: PipelinePr }) {
  const [head, ...older] = pr.commits;
  return (
    <article className="card" data-testid="pr-card" data-pr={pr.number}>
      <header>
        <h2>
          <a
            href={`https://github.com/${DEMO_REPO}/pull/${pr.number}`}
            target="_blank"
            rel="noreferrer"
          >
            #{pr.number}
          </a>{" "}
          {pr.title ?? "Sin título"}
        </h2>
        <p className="row">
          <Badge state={pr.state} labels={PR_STATE} testId="pr-status" />
          {pr.branch && <code>{pr.branch}</code>}
        </p>
      </header>
      {head && <Commit commit={head} />}
      {older.length > 0 && (
        <details>
          <summary>Commits anteriores ({older.length})</summary>
          {older.map((commit) => (
            <div key={commit.sha} className="older">
              <Commit commit={commit} />
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
