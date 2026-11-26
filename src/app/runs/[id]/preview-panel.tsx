import { Screenshots } from "@/app/screenshots";
import type { PipelineScreenshot } from "@/server/pipeline/queries";
import type { CriterionView, TaskSection } from "@/server/runs/task-view";

type Props = {
  headSha: string | null;
  preview: { previewUrl: string | null; deployState: string | null } | null;
  report: { passed: number; failed: number; runUrl: string } | null;
  section: TaskSection | null;
  shots: PipelineScreenshot[];
  awaitingApproval: boolean;
};

const DEPLOY: Record<string, string> = {
  pending: "el build de Vercel está en cola",
  in_progress: "Vercel está construyendo la vista previa",
  failure: "el build de Vercel ha fallado",
  error: "el build de Vercel ha fallado",
};

function criteriaOf(section: TaskSection): CriterionView[] {
  return section.groups.flatMap((g) =>
    (g.kind === "task" ? [g.task] : g.tasks).flatMap((t) => t.criteria),
  );
}

/**
 * The real preview opens in its own tab: crm-demo's login cookie would be
 * third-party inside an iframe (D45). Here: the button, the screenshots at
 * 1280 and 390 px and the result of the criteria (D43).
 */
export function PreviewPanel({
  headSha,
  preview,
  report,
  section,
  shots,
  awaitingApproval,
}: Props) {
  const ready = preview?.deployState === "success" && preview.previewUrl;
  const criteria = section
    ? criteriaOf(section).filter((c) => c.type === "e2e")
    : [];
  const passed = criteria.filter((c) => c.outcome === "pass").length;
  return (
    <section
      className={`card stack preview-panel${awaitingApproval ? " preview-panel-approval" : ""}`}
      data-testid="preview-panel"
    >
      <h2>Vista previa</h2>
      {!headSha ? (
        <p className="muted">
          Todavía no hay vista previa: llega cuando Develop sube el primer
          commit.
        </p>
      ) : ready ? (
        <>
          <p>
            <a
              className="button"
              href={preview.previewUrl!}
              target="_blank"
              rel="noreferrer"
              data-testid="open-preview"
            >
              Abrir vista previa ↗
            </a>
          </p>
          <p className="muted">
            Se abre en otra pestaña con el CRM de esta rama (
            <code>{headSha.slice(0, 7)}</code>). Si pide acceso, entra con el
            usuario de demo de crm-demo.
          </p>
        </>
      ) : (
        <p className="muted">
          Vista previa de <code>{headSha.slice(0, 7)}</code>:{" "}
          {DEPLOY[preview?.deployState ?? ""] ?? "esperando a Vercel"}.
        </p>
      )}

      {criteria.length > 0 && (
        <div data-testid="preview-criteria">
          <p className="row">
            <strong>
              Criterios: {passed} de {criteria.length} en verde
            </strong>
            {report && (
              <a href={report.runUrl} target="_blank" rel="noreferrer">
                ejecución de Playwright
              </a>
            )}
          </p>
          <ul className="preview-criteria">
            {criteria.map((c) => (
              <li key={c.key} data-outcome={c.outcome}>
                <code>{c.id}</code> {c.text}{" "}
                {c.results.map((r) => (
                  <span
                    key={r.project}
                    className={`badge badge-${r.outcome === "pass" ? "ok" : r.outcome === "fail" ? "bad" : "neutral"}`}
                  >
                    {r.label}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {shots.length > 0 ? (
        <Screenshots shots={shots} />
      ) : (
        headSha && (
          <p className="muted">
            Sin capturas todavía: llegan con el informe de Playwright.
          </p>
        )
      )}
    </section>
  );
}
