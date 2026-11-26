import type { ReactNode } from "react";
import type { Step } from "@/server/agents/contracts";
import type {
  CriterionView,
  TaskSection,
  TaskView,
} from "@/server/runs/task-view";
import { statusTone, TASK_STATUS } from "../labels";

const OUTCOME: Record<string, { label: string; tone: string }> = {
  pass: { label: "pasa", tone: "ok" },
  fail: { label: "falla", tone: "bad" },
  pending: { label: "sin resultado", tone: "neutral" },
  manual: { label: "sin comprobar", tone: "neutral" },
};

/** One line per step, as the runner reads it (D38). */
function describeStep(step: Step): string {
  const nth = "nth" in step && step.nth ? ` [${step.nth}]` : "";
  switch (step.action) {
    case "goto":
      return `ir a ${step.page ?? step.path}`;
    case "fill":
      return `escribir «${step.value}» en ${step.testId}${nth}`;
    case "select":
      return `elegir «${step.value}» en ${step.testId}${nth}`;
    case "click":
      return `pulsar ${step.testId}${nth}`;
    case "expectVisible":
      return `ver ${step.testId}${nth}`;
    case "expectText":
      return `${step.all ? "todos los " : ""}${step.testId}${nth} contienen «${step.text}»`;
    case "expectCount":
      return step.count !== undefined
        ? `${step.count} × ${step.testId}`
        : `al menos ${step.min} × ${step.testId}`;
  }
}

function Criterion({ c }: { c: CriterionView }) {
  const outcome = OUTCOME[c.outcome]!;
  return (
    <li
      className="criterion"
      data-testid="criterion"
      data-type={c.type}
      data-outcome={c.outcome}
    >
      <p className="criterion-head">
        <code>{c.id}</code>
        <span className="criterion-text">{c.text}</span>
      </p>
      <p className="row criterion-results">
        {c.results.length === 0 ? (
          <span className={`badge badge-${outcome.tone}`}>
            {c.type === "visual" ? "visual · " : ""}
            {outcome.label}
          </span>
        ) : (
          c.results.map((r) => (
            <span
              key={r.project}
              className={`badge badge-${OUTCOME[r.outcome]!.tone}`}
              data-testid="criterion-result"
              data-project={r.project}
              data-outcome={r.outcome}
            >
              {r.label}: {OUTCOME[r.outcome]!.label}
            </span>
          ))
        )}
      </p>
      {c.outcome === "fail" && (
        <div className="criterion-failure" data-testid="criterion-failure">
          {c.reason && <p>{c.reason}</p>}
          {c.failedStep && (
            <p className="muted">
              Paso que falla: <code>{c.failedStep}</code>
            </p>
          )}
          {!c.reason && c.error && (
            <p className="muted">{c.error.split("\n")[0]}</p>
          )}
        </div>
      )}
      {c.steps.length > 0 && (
        <details className="criterion-steps">
          <summary>Pasos de Testing ({c.steps.length})</summary>
          <ol data-testid="criterion-steps">
            {c.steps.map((s, i) => (
              <li key={i}>
                <code>{describeStep(s)}</code>
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}

function Task({
  t,
  commitUrl,
  extra,
}: {
  t: TaskView;
  commitUrl: (sha: string) => string;
  extra?: ReactNode;
}) {
  return (
    <li
      className="task"
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
        {t.iteration > 0 && (
          <span className="muted" data-testid="task-iteration">
            iteración {t.iteration} de {t.maxIterations}
          </span>
        )}
        {t.commitSha && (
          <a href={commitUrl(t.commitSha)} target="_blank" rel="noreferrer">
            <code>{t.commitSha.slice(0, 7)}</code>
          </a>
        )}
      </p>
      <p className="muted">{t.description}</p>
      {t.touched.length > 0 && (
        <p className="files" data-testid="task-files">
          {t.touched.map((f) => (
            <code
              key={f.path}
              className={f.outside ? "file-outside" : undefined}
              title={f.outside ? "Fuera de los archivos del plan" : undefined}
              data-outside={f.outside || undefined}
            >
              {f.path}
              {f.outside && " · fuera del plan"}
            </code>
          ))}
        </p>
      )}
      {extra}
      <ul className="criteria">
        {t.criteria.map((c) => (
          <Criterion key={c.key} c={c} />
        ))}
      </ul>
      {t.lastFeedback && t.status !== "passed" && (
        <details>
          <summary>Feedback para Develop</summary>
          <pre className="feedback">{t.lastFeedback}</pre>
        </details>
      )}
    </li>
  );
}

/** Tasks, criteria and regression of the current revision (D43). */
export function Tasks({
  section,
  commitUrl,
  extra,
}: {
  section: TaskSection;
  commitUrl: (sha: string) => string;
  extra?: (taskId: number) => ReactNode;
}) {
  const { regression } = section;
  const failing = regression.passed < regression.total;
  return (
    <section className="card stack" data-testid="run-tasks-section">
      <h2>Tareas y criterios</h2>
      <ol className="task-list" data-testid="run-tasks">
        {section.groups.map((g) =>
          g.kind === "task" ? (
            <Task
              key={g.task.id}
              t={g.task}
              commitUrl={commitUrl}
              extra={extra?.(g.task.id)}
            />
          ) : (
            <li key={`split-${g.from}`} className="task-split">
              <p className="muted" data-testid="task-split-from">
                Dividida en {g.tasks.length} subtareas: «{g.title}»
              </p>
              <ol className="task-list">
                {g.tasks.map((t) => (
                  <Task
                    key={t.id}
                    t={t}
                    commitUrl={commitUrl}
                    extra={extra?.(t.id)}
                  />
                ))}
              </ol>
            </li>
          ),
        )}
      </ol>
      {regression.total > 0 && (
        <details
          className="regression"
          open={failing}
          data-testid="regression"
          data-failing={failing}
        >
          <summary>
            Regresión: {regression.passed} de {regression.total} en verde
          </summary>
          <ul>
            {regression.items.map((r) => (
              <li key={r.title} data-outcome={r.outcome}>
                <span className={`badge badge-${OUTCOME[r.outcome]!.tone}`}>
                  {OUTCOME[r.outcome]!.label}
                </span>{" "}
                {r.title}
                {r.error && (
                  <span className="muted"> · {r.error.split("\n")[0]}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
