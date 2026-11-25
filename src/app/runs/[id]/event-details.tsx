import type { CallMeta } from "@/server/llm/provider";

/**
 * What the engine stores in run_events.data for each kind (H5): the files
 * Develop read (D32), its commit with notes and hints (D34), the result of
 * pr-check (D33) and the split of a task (D34). Data is read defensively:
 * older runs stored less.
 */

const CALL_KIND: Record<string, string> = {
  first: "llamada",
  repair: "reparación",
};

export const ROLE: Record<string, string> = {
  base: "base",
  planned: "previsto",
  reference: "referencia",
  import: "import",
};

const tokens = new Intl.NumberFormat("es-ES");
const seconds = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export type ContextData = {
  taskId?: number;
  files: { path: string; role: string }[];
  trimmed: string[];
  newFiles: string[];
};

export function contextData(data: unknown): ContextData {
  const d = obj(data);
  return {
    taskId: typeof d.taskId === "number" ? d.taskId : undefined,
    files: Array.isArray(d.files)
      ? d.files.map((f) => ({
          path: String(obj(f).path ?? f),
          role: String(obj(f).role ?? ""),
        }))
      : [],
    trimmed: strings(d.trimmed),
    newFiles: strings(d.newFiles),
  };
}

/**
 * The backup links of a chain: a failed iteration may come from them
 * (D35, D36).
 */
function fallbackNote(model: string): string | null {
  if (model.includes("flash-lite")) {
    return "Flash-Lite, el último respaldo de Gemini: si falla la iteración, puede venir de aquí";
  }
  if (model.startsWith("groq:")) return "Groq, respaldo de Gemini";
  return null;
}

/** Model, tokens and latency of each LLM call of an event (D26, D36). */
export function Calls({ data }: { data: unknown }) {
  const d = obj(data);
  const calls = Array.isArray(d.calls) ? (d.calls as CallMeta[]) : [];
  const cached = d.cached === true;
  if (calls.length === 0) return null;
  return (
    <ul className="calls">
      {calls.map((c, i) => {
        const note = fallbackNote(c.model);
        return (
          <li
            key={i}
            data-testid="llm-call"
            data-model={c.model}
            data-cached={cached}
            data-fallback={note ? "true" : undefined}
          >
            <code>{c.model}</code> · {CALL_KIND[c.kind] ?? c.kind}
            {c.valid ? "" : " (no válida)"} · {tokens.format(c.inputTokens)} →{" "}
            {tokens.format(c.outputTokens)} tokens ·{" "}
            {seconds.format(c.latencyMs / 1000)} s
            {cached && " · de la caché, sin llamar de nuevo"}
            {note && (
              <>
                {" "}
                <span className="badge badge-bad">{note}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ContextFiles({ context }: { context: ContextData }) {
  return (
    <ul className="files-read" data-testid="develop-context">
      {context.files.map((f) => (
        <li key={f.path} data-role={f.role}>
          <code>{f.path}</code>{" "}
          <span className="muted">{ROLE[f.role] ?? f.role}</span>
        </li>
      ))}
      {context.newFiles.map((p) => (
        <li key={p} data-role="new">
          <code>{p}</code> <span className="muted">nuevo</span>
        </li>
      ))}
      {context.trimmed.map((p) => (
        <li key={p} data-role="trimmed">
          <code>{p}</code>{" "}
          <span className="muted">recortado por tamaño, no lo ha leído</span>
        </li>
      ))}
    </ul>
  );
}

function Commit({ data }: { data: Obj }) {
  const files = strings(data.files);
  const outside = new Set(strings(data.outsidePlan));
  const evidence = Array.isArray(data.evidence)
    ? data.evidence.map((e) => obj(e))
    : [];
  return (
    <div className="event-details">
      {files.length > 0 && (
        <p className="files" data-testid="commit-files">
          {files.map((f) => (
            <code key={f} data-outside={outside.has(f) || undefined}>
              {f}
              {outside.has(f) && " · fuera del plan"}
            </code>
          ))}
        </p>
      )}
      {typeof data.notes === "string" && (
        <p data-testid="develop-notes">{data.notes}</p>
      )}
      {evidence.length > 0 && (
        <ul className="criteria" data-testid="develop-evidence">
          {evidence.map((e, i) => (
            <li key={i}>
              <span className="badge badge-neutral">{String(e.criterion)}</span>{" "}
              {String(e.hint)}{" "}
              <span className="muted">(pista para Testing, no prueba)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Check({ data }: { data: Obj }) {
  const errors = obj(data.errors);
  const blocks = [
    ["drizzle-kit generate", errors.migrate],
    ["tsc --noEmit", errors.typecheck],
    ["ESLint", errors.lint],
  ].filter((b): b is [string, string] => typeof b[1] === "string");
  return (
    <div className="event-details">
      {typeof data.runUrl === "string" && (
        <a href={data.runUrl} target="_blank" rel="noreferrer">
          ejecución de pr-check
        </a>
      )}
      {typeof data.error === "string" && <p className="error">{data.error}</p>}
      {blocks.map(([title, text]) => (
        <details key={title} data-testid="check-errors">
          <summary>{title}</summary>
          <pre>{text}</pre>
        </details>
      ))}
    </div>
  );
}

function SplitDetails({ data }: { data: Obj }) {
  const split = obj(data.split);
  const tasks = Array.isArray(split.tasks) ? split.tasks.map(obj) : [];
  return (
    <ol className="event-details" data-testid="split-tasks">
      {tasks.map((t, i) => {
        const criteria = Array.isArray(t.acceptanceCriteria)
          ? t.acceptanceCriteria.map((c) => String(obj(c).id))
          : [];
        return (
          <li key={i}>
            {String(t.title)} ·{" "}
            <span className="muted">
              {criteria.length > 0
                ? `criterios ${criteria.join(", ")}`
                : "sin criterios propios"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Extra lines under a timeline event, by kind. */
export function EventDetails({ kind, data }: { kind: string; data: unknown }) {
  const d = obj(data);
  switch (kind) {
    case "context":
      return (
        <details className="event-details">
          <summary>Archivos que ha leído</summary>
          <ContextFiles context={contextData(data)} />
        </details>
      );
    case "commit":
      return <Commit data={d} />;
    case "check_failed":
    case "check_passed":
      return <Check data={d} />;
    case "split":
      return <SplitDetails data={d} />;
    default:
      return null;
  }
}
