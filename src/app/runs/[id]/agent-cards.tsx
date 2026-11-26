import type { AgentCard } from "@/server/runs/agent-cards";
import { ACTOR } from "../labels";

const TONE_LABEL: Record<AgentCard["tone"], string> = {
  idle: "en espera",
  work: "trabajando",
  ok: "hecho",
  bad: "bloqueado",
};

/** "hace 3 min", from the render time (the page re-renders every 5 s). */
function elapsed(since: Date, now: number): string {
  const seconds = Math.max(0, Math.round((now - since.getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** Who is working now (D42): 2×2 on mobile, one row on desktop. */
export function AgentCards({
  cards,
  now,
}: {
  cards: AgentCard[];
  now: number;
}) {
  return (
    <section
      className="agent-cards"
      aria-label="Estado de los agentes"
      data-testid="agent-cards"
    >
      {cards.map((c) => (
        <article
          key={c.agent}
          className={`agent-card agent-card-${c.tone}${c.active ? " agent-card-active" : ""}`}
          data-testid="agent-card"
          data-agent={c.agent}
          data-tone={c.tone}
          data-active={c.active}
          aria-current={c.active ? "step" : undefined}
        >
          <header className="agent-card-head">
            <span className={`actor actor-${c.agent}`}>
              {c.agent === "human" ? "Tú" : (ACTOR[c.agent] ?? c.agent)}
            </span>
            <span className="agent-card-tone">
              {c.agent === "human" && c.active ? "te toca" : TONE_LABEL[c.tone]}
            </span>
          </header>
          <p className="agent-card-label" data-testid="agent-card-label">
            {c.label}
          </p>
          {c.detail && <p className="agent-card-detail">{c.detail}</p>}
          {c.postponed && (
            <p
              className="agent-card-postponed"
              data-testid="agent-card-postponed"
            >
              {c.postponed}
            </p>
          )}
          {(c.model || c.since) && (
            <p className="agent-card-meta">
              {c.since && <span>hace {elapsed(c.since, now)}</span>}
              {c.model && (
                <code title={c.model} data-testid="agent-card-model">
                  {c.model.split(":").at(-1)}
                </code>
              )}
              {c.paid && (
                <span
                  className="badge badge-bad"
                  title="Respaldo de pago (D37)"
                >
                  pago
                </span>
              )}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
