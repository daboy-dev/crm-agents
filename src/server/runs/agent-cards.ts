/**
 * Cards of /runs/[id] (D42): what each agent and the human are doing now.
 * Pure and derived from the state machine (D21), so a card cannot
 * contradict the run. The waits for GitHub and Vercel go in the card of the
 * agent that waits for them. If the machine changes, so does
 * agent-cards.test.ts.
 */

import type { Criterion } from "@/server/agents/contracts";
import { STEP_STATUSES, type RunStatus } from "./machine";

export type CardAgent = "orchestrator" | "develop" | "testing" | "human";

/** idle: waiting its turn · work: on it · ok: done · bad: blocked or rejected. */
export type CardTone = "idle" | "work" | "ok" | "bad";

export type AgentCard = {
  agent: CardAgent;
  tone: CardTone;
  /** The card the run depends on now; at most one. */
  active: boolean;
  label: string;
  detail: string | null;
  /** Model of the agent's last call ("provider:model"). */
  model: string | null;
  /** The model is not the head of the agent's chain: a backup (D36, D49). */
  fallback: boolean;
  /** Since when the active card is in its state. */
  since: Date | null;
  /** Why the step is postponed: saturation or a per-minute limit. */
  postponed: string | null;
};

export type CardRun = {
  status: RunStatus;
  planRevision: number;
  statusChangedAt: Date;
  headSha: string | null;
  feedback: string | null;
  splitTaskId: number | null;
  blockedFrom: string | null;
  blockedReason: string | null;
  rejectedReason: string | null;
};

export type CardTask = {
  id: number;
  position: number;
  status: string;
  iteration: number;
  maxIterations: number;
  acceptanceCriteria: Pick<Criterion, "type">[];
};

export type CardStep = {
  agent: string;
  taskId: number | null;
  iteration: number;
  scope: string;
  model: string | null;
  createdAt: Date;
};

export type CardEvent = {
  id: number;
  actor: string;
  kind: string;
  data: unknown;
  at: Date;
};

export type CardInput = {
  run: CardRun;
  /** Tasks of the current plan revision. */
  tasks: CardTask[];
  steps: CardStep[];
  events: CardEvent[];
  /** Deploy state of the head's preview, if any. */
  deployState?: string | null;
  /** First link of each agent's chain ("provider:model"), from chainFor. */
  chainHeads?: Partial<Record<string, string>>;
};

/** Testing's steps for a revision (D38); same scope as the engine. */
const STEPS_SCOPE = "steps";

const AGENTS: CardAgent[] = ["orchestrator", "develop", "testing", "human"];

/** The agent each blocked status belongs to. */
const BLOCKED_OWNER: Record<string, CardAgent> = {
  planning: "orchestrator",
  developing: "develop",
  awaiting_check: "develop",
  awaiting_preview: "testing",
  testing: "testing",
  merging: "human",
};

type Draft = Pick<AgentCard, "tone" | "label"> &
  Partial<Pick<AgentCard, "active" | "detail" | "since">>;

const idle = (label = "En espera"): Draft => ({ tone: "idle", label });

function lastModel(steps: CardStep[], agent: string): string | null {
  let last: CardStep | null = null;
  for (const s of steps) {
    if (s.agent !== agent || !s.model) continue;
    if (!last || s.createdAt >= last.createdAt) last = s;
  }
  return last?.model ?? null;
}

/** The latest event, when it says that the current step was postponed. */
function postponement(input: CardInput): string | null {
  if (!STEP_STATUSES.includes(input.run.status)) return null;
  const last = input.events.at(-1);
  if (!last) return null;
  if (last.kind === "overloaded") return "Modelo saturado · se reanuda solo";
  if (last.kind === "rate_limited") {
    const model = (last.data as { model?: unknown } | null)?.model;
    return `Límite por minuto${typeof model === "string" ? ` de ${model}` : ""} · se reanuda solo`;
  }
  return null;
}

const e2eCount = (tasks: CardTask[]) =>
  tasks.reduce(
    (n, t) => n + t.acceptanceCriteria.filter((c) => c.type === "e2e").length,
    0,
  );

function hasStep(
  steps: CardStep[],
  agent: string,
  taskId: number | null,
  iteration: number,
  scope = "",
): CardStep | undefined {
  return steps.find(
    (s) =>
      s.agent === agent &&
      s.taskId === taskId &&
      s.iteration === iteration &&
      s.scope === scope,
  );
}

function orchestratorPlanning(run: CardRun): Draft {
  if (run.splitTaskId !== null) {
    return {
      tone: "work",
      active: true,
      label: "Dividiendo una tarea demasiado grande",
      detail: `Revisión ${run.planRevision}`,
    };
  }
  if (run.planRevision > 1) {
    return {
      tone: "work",
      active: true,
      label: `Replanificando · revisión ${run.planRevision}`,
      detail: run.headSha
        ? "Tareas nuevas sobre la rama, con tu feedback"
        : "Plan nuevo con tu feedback",
    };
  }
  return {
    tone: "work",
    active: true,
    label: "Planificando",
    detail: "Lee crm-demo y prepara el plan",
  };
}

function planReady(run: CardRun, tasks: CardTask[]): Draft {
  return {
    tone: "ok",
    label: `Plan listo · revisión ${run.planRevision}`,
    detail: `${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}`,
  };
}

/** Develop while the run is developing: one call per task (D35). */
function developing(input: CardInput): {
  develop: Draft;
  testing: Draft | null;
} {
  const { run, tasks, steps } = input;
  const needsSteps =
    e2eCount(tasks) > 0 &&
    !hasStep(steps, "testing", null, run.planRevision, STEPS_SCOPE);
  if (needsSteps) {
    return {
      develop: idle("Espera los pasos de Testing"),
      testing: {
        tone: "work",
        active: true,
        label: "Escribiendo los pasos",
        detail: `${e2eCount(tasks)} criterios E2E de la revisión ${run.planRevision}`,
      },
    };
  }
  const work = tasks.filter((t) => t.status === "developing");
  const done = work.filter((t) => hasStep(steps, "develop", t.id, t.iteration));
  const current = work.find(
    (t) => !hasStep(steps, "develop", t.id, t.iteration),
  );
  const since = done.reduce<Date>((latest, t) => {
    const at = hasStep(steps, "develop", t.id, t.iteration)!.createdAt;
    return at > latest ? at : latest;
  }, run.statusChangedAt);
  if (!current) {
    return {
      develop: {
        tone: "work",
        active: true,
        label: "Subiendo los commits",
        detail: `${work.length} ${work.length === 1 ? "tarea" : "tareas"} a la rama`,
        since,
      },
      testing: null,
    };
  }
  return {
    develop: {
      tone: "work",
      active: true,
      label: `${current.iteration > 1 ? "Corrigiendo" : "Escribiendo"} la tarea ${current.position}`,
      detail: `Iteración ${current.iteration} de ${current.maxIterations}`,
      since,
    },
    testing: null,
  };
}

function testingAfterDevelop(input: CardInput): Draft {
  const { tasks, events } = input;
  // Develop is correcting: Testing explained the failures of the last report.
  const explained = events.some(
    (e) => e.actor === "testing" && e.kind === "explain",
  );
  const retrying = tasks.some(
    (t) => t.status === "developing" && t.iteration > 1,
  );
  if (retrying && explained) {
    return { tone: "idle", label: "Explicó los fallos a Develop" };
  }
  return idle();
}

function lastIteration(tasks: CardTask[]): number {
  return tasks.reduce((n, t) => Math.max(n, t.iteration), 0);
}

function draftCards(input: CardInput): Record<CardAgent, Draft> {
  const { run, tasks } = input;
  const total = e2eCount(tasks);
  const green: Draft = {
    tone: "ok",
    label: "Todo en verde",
    detail: `${total} de ${total} criterios E2E`,
  };
  const developDone: Draft = {
    tone: "ok",
    label: "Hecho",
    detail: `Iteración ${lastIteration(tasks)}`,
  };
  const approved: Draft = { tone: "ok", label: "Plan aprobado" };
  const nothing = idle("Nada pendiente");

  switch (run.status) {
    case "queued":
      return {
        orchestrator: idle("En cola: espera su turno"),
        develop: idle(),
        testing: idle(),
        human: nothing,
      };
    case "planning":
      return {
        orchestrator: orchestratorPlanning(run),
        develop: idle(),
        testing: idle(),
        human: nothing,
      };
    case "awaiting_plan_approval":
      return {
        orchestrator: planReady(run, tasks),
        develop: idle(),
        testing: idle(),
        human: {
          tone: "work",
          active: true,
          label: "Aprobar el plan",
          detail: `Revisión ${run.planRevision}`,
        },
      };
    case "developing": {
      const { develop, testing } = developing(input);
      return {
        orchestrator: approved,
        develop,
        testing: testing ?? testingAfterDevelop(input),
        human: nothing,
      };
    }
    case "awaiting_check":
      return {
        orchestrator: approved,
        develop: {
          tone: "work",
          active: true,
          label: "Esperando pr-check",
          detail: "Migración, tipos y lint en GitHub Actions",
        },
        testing: idle(),
        human: nothing,
      };
    case "awaiting_preview":
      return {
        orchestrator: approved,
        develop: developDone,
        testing: {
          tone: "work",
          active: true,
          label: "Esperando la vista previa",
          detail:
            input.deployState === "success"
              ? "Playwright en GitHub Actions"
              : "Build de Vercel",
        },
        human: nothing,
      };
    case "testing":
      return {
        orchestrator: approved,
        develop: developDone,
        testing: {
          tone: "work",
          active: true,
          label: "Revisando el informe de Playwright",
          detail: `${total} criterios E2E`,
        },
        human: nothing,
      };
    case "awaiting_final_approval":
      return {
        orchestrator: approved,
        develop: developDone,
        testing: green,
        human: {
          tone: "work",
          active: true,
          label: "Aprobar la vista previa final",
          detail: "Al aprobar se fusiona el PR",
        },
      };
    case "merging":
      return {
        orchestrator: approved,
        develop: developDone,
        testing: green,
        human: { tone: "ok", label: "Aprobado: se fusiona el PR" },
      };
    case "done":
      return {
        orchestrator: approved,
        develop: developDone,
        testing: green,
        human: { tone: "ok", label: "Fusionado en master" },
      };
    case "blocked": {
      const owner = BLOCKED_OWNER[run.blockedFrom ?? ""] ?? "develop";
      const stuck = tasks.find(
        (t) => t.status === "blocked" || t.status === "failed",
      );
      const cards: Record<CardAgent, Draft> = {
        orchestrator: owner === "orchestrator" ? idle() : approved,
        develop: idle(),
        testing: idle(),
        human: {
          tone: "work",
          active: true,
          label: stuck
            ? `Decidir sobre la tarea ${stuck.position}`
            : "Decidir sobre el run bloqueado",
          detail: "Reintentar o abandonar",
        },
      };
      if (owner !== "human") {
        cards[owner] = {
          tone: "bad",
          label:
            stuck && owner === "develop"
              ? `Bloqueado en la tarea ${stuck.position}`
              : "Bloqueado",
          detail: run.blockedReason,
        };
      }
      return cards;
    }
    case "rejected":
      return run.rejectedReason
        ? {
            orchestrator: {
              tone: "bad",
              label: "Petición rechazada",
              detail: run.rejectedReason,
            },
            develop: idle(),
            testing: idle(),
            human: nothing,
          }
        : {
            orchestrator: planReady(run, tasks),
            develop: idle(),
            testing: idle(),
            human: { tone: "bad", label: "Rechazado por el cliente" },
          };
    case "cancelled":
    case "failed": {
      const label =
        run.status === "cancelled" ? "Run cancelado" : "Run fallido";
      return {
        orchestrator: idle(label),
        develop: idle(label),
        testing: idle(label),
        human: nothing,
      };
    }
  }
}

/** A real model that is not the head of the chain; never the mock. */
const isFallback = (model: string | null, head: string | undefined) =>
  model !== null &&
  head !== undefined &&
  !model.startsWith("mock") &&
  model !== head;

export function agentCards(input: CardInput): AgentCard[] {
  const drafts = draftCards(input);
  const postponed = postponement(input);
  return AGENTS.map((agent) => {
    const d = drafts[agent];
    const active = d.active === true;
    const model = agent === "human" ? null : lastModel(input.steps, agent);
    return {
      agent,
      tone: d.tone,
      active,
      label: d.label,
      detail: d.detail ?? null,
      model,
      fallback: isFallback(model, input.chainHeads?.[agent]),
      since: active ? (d.since ?? input.run.statusChangedAt) : null,
      postponed: active && agent !== "human" ? postponed : null,
    };
  });
}
