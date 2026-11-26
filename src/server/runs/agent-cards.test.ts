import { describe, expect, it } from "vitest";
import {
  agentCards,
  type CardAgent,
  type CardEvent,
  type CardInput,
  type CardRun,
  type CardStep,
  type CardTask,
  type CardTone,
} from "./agent-cards";
import { RUN_STATUSES, type RunStatus } from "./machine";

const T0 = new Date("2026-11-26T10:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const run = (status: RunStatus, over: Partial<CardRun> = {}): CardRun => ({
  status,
  planRevision: 1,
  statusChangedAt: T0,
  headSha: null,
  feedback: null,
  splitTaskId: null,
  blockedFrom: null,
  blockedReason: null,
  rejectedReason: null,
  ...over,
});

const task = (id: number, over: Partial<CardTask> = {}): CardTask => ({
  id,
  position: id,
  status: "pending",
  iteration: 0,
  maxIterations: 3,
  acceptanceCriteria: [{ type: "e2e" }, { type: "visual" }],
  ...over,
});

const step = (over: Partial<CardStep>): CardStep => ({
  agent: "develop",
  taskId: null,
  iteration: 1,
  scope: "",
  model: "gemini:gemini-3-flash",
  createdAt: at(1),
  ...over,
});

const testingSteps = (revision = 1, model = "gemini:gemini-3-flash") =>
  step({ agent: "testing", iteration: revision, scope: "steps", model });

const event = (id: number, kind: string, data: unknown = null): CardEvent => ({
  id,
  actor: "system",
  kind,
  data,
  at: at(id),
});

const developingTasks = (iteration = 1) => [
  task(1, { status: "developing", iteration }),
  task(2, { status: "developing", iteration }),
];

type Expect = { tone: CardTone; label: string; active?: boolean };

type Row = {
  name: string;
  input: CardInput;
  cards: Partial<Record<CardAgent, Expect>>;
};

const input = (r: CardRun, over: Partial<CardInput> = {}): CardInput => ({
  run: r,
  tasks: [task(1), task(2)],
  steps: [],
  events: [],
  ...over,
});

const table: Row[] = [
  {
    name: "queued: everyone waits",
    input: input(run("queued"), { tasks: [] }),
    cards: {
      orchestrator: { tone: "idle", label: "En cola: espera su turno" },
      human: { tone: "idle", label: "Nada pendiente" },
    },
  },
  {
    name: "first plan",
    input: input(run("planning"), { tasks: [] }),
    cards: {
      orchestrator: { tone: "work", label: "Planificando", active: true },
    },
  },
  {
    name: "replan with feedback on the branch",
    input: input(
      run("planning", { planRevision: 2, headSha: "abc", feedback: "x" }),
    ),
    cards: {
      orchestrator: {
        tone: "work",
        label: "Replanificando · revisión 2",
        active: true,
      },
    },
  },
  {
    name: "split of a task (D34)",
    input: input(run("planning", { planRevision: 2, splitTaskId: 1 })),
    cards: {
      orchestrator: {
        tone: "work",
        label: "Dividiendo una tarea demasiado grande",
        active: true,
      },
    },
  },
  {
    name: "plan waits for the human",
    input: input(run("awaiting_plan_approval")),
    cards: {
      orchestrator: { tone: "ok", label: "Plan listo · revisión 1" },
      human: { tone: "work", label: "Aprobar el plan", active: true },
    },
  },
  {
    name: "Testing writes the steps before Develop (D38)",
    input: input(run("developing"), { tasks: developingTasks() }),
    cards: {
      develop: { tone: "idle", label: "Espera los pasos de Testing" },
      testing: { tone: "work", label: "Escribiendo los pasos", active: true },
    },
  },
  {
    name: "no e2e criteria: no steps to write",
    input: input(run("developing"), {
      tasks: developingTasks().map((t) => ({
        ...t,
        acceptanceCriteria: [{ type: "visual" as const }],
      })),
    }),
    cards: {
      develop: { tone: "work", label: "Escribiendo la tarea 1", active: true },
      testing: { tone: "idle", label: "En espera" },
    },
  },
  {
    name: "Develop on the first task",
    input: input(run("developing"), {
      tasks: developingTasks(),
      steps: [testingSteps()],
    }),
    cards: {
      orchestrator: { tone: "ok", label: "Plan aprobado" },
      develop: { tone: "work", label: "Escribiendo la tarea 1", active: true },
    },
  },
  {
    name: "Develop on the second task (D35)",
    input: input(run("developing"), {
      tasks: developingTasks(),
      steps: [testingSteps(), step({ taskId: 1 })],
    }),
    cards: {
      develop: { tone: "work", label: "Escribiendo la tarea 2", active: true },
    },
  },
  {
    name: "every task answered: pushing",
    input: input(run("developing"), {
      tasks: developingTasks(),
      steps: [testingSteps(), step({ taskId: 1 }), step({ taskId: 2 })],
    }),
    cards: {
      develop: { tone: "work", label: "Subiendo los commits", active: true },
    },
  },
  {
    name: "Develop corrects after Testing explained",
    input: input(run("developing"), {
      tasks: [
        task(1, { status: "passed", iteration: 1 }),
        task(2, { status: "developing", iteration: 2 }),
      ],
      steps: [testingSteps(), step({ taskId: 1 }), step({ taskId: 2 })],
      events: [{ ...event(1, "explain"), actor: "testing" }],
    }),
    cards: {
      develop: { tone: "work", label: "Corrigiendo la tarea 2", active: true },
      testing: { tone: "idle", label: "Explicó los fallos a Develop" },
    },
  },
  {
    name: "pr-check is Develop's wait",
    input: input(run("awaiting_check", { headSha: "abc" })),
    cards: {
      develop: { tone: "work", label: "Esperando pr-check", active: true },
    },
  },
  {
    name: "the preview is Testing's wait",
    input: input(run("awaiting_preview", { headSha: "abc" }), {
      tasks: [task(1, { status: "testing", iteration: 1 })],
    }),
    cards: {
      develop: { tone: "ok", label: "Hecho" },
      testing: {
        tone: "work",
        label: "Esperando la vista previa",
        active: true,
      },
    },
  },
  {
    name: "Testing reads the report",
    input: input(run("testing", { headSha: "abc" })),
    cards: {
      testing: {
        tone: "work",
        label: "Revisando el informe de Playwright",
        active: true,
      },
    },
  },
  {
    name: "final approval",
    input: input(run("awaiting_final_approval", { headSha: "abc" })),
    cards: {
      testing: { tone: "ok", label: "Todo en verde" },
      human: {
        tone: "work",
        label: "Aprobar la vista previa final",
        active: true,
      },
    },
  },
  {
    name: "merging",
    input: input(run("merging", { headSha: "abc" })),
    cards: { human: { tone: "ok", label: "Aprobado: se fusiona el PR" } },
  },
  {
    name: "done",
    input: input(run("done", { headSha: "abc" })),
    cards: {
      develop: { tone: "ok", label: "Hecho" },
      human: { tone: "ok", label: "Fusionado en master" },
    },
  },
  {
    name: "blocked in a task",
    input: input(
      run("blocked", { blockedFrom: "developing", blockedReason: "límite" }),
      {
        tasks: [task(1, { status: "passed" }), task(2, { status: "blocked" })],
      },
    ),
    cards: {
      develop: { tone: "bad", label: "Bloqueado en la tarea 2" },
      human: { tone: "work", label: "Decidir sobre la tarea 2", active: true },
    },
  },
  {
    name: "blocked waiting for the preview",
    input: input(run("blocked", { blockedFrom: "awaiting_preview" })),
    cards: {
      testing: { tone: "bad", label: "Bloqueado" },
      develop: { tone: "idle", label: "En espera" },
      human: {
        tone: "work",
        label: "Decidir sobre el run bloqueado",
        active: true,
      },
    },
  },
  {
    name: "out of scope (D28)",
    input: input(run("rejected", { rejectedReason: "no es del CRM" }), {
      tasks: [],
    }),
    cards: { orchestrator: { tone: "bad", label: "Petición rechazada" } },
  },
  {
    name: "rejected by the human",
    input: input(run("rejected")),
    cards: { human: { tone: "bad", label: "Rechazado por el cliente" } },
  },
  {
    name: "cancelled",
    input: input(run("cancelled")),
    cards: { develop: { tone: "idle", label: "Run cancelado" } },
  },
];

describe("agentCards (D42)", () => {
  it.each(table)("$name", ({ input, cards }) => {
    const got = agentCards(input);
    for (const [agent, want] of Object.entries(cards)) {
      const card = got.find((c) => c.agent === agent)!;
      expect(card.tone).toBe(want.tone);
      expect(card.label).toBe(want.label);
      expect(card.active).toBe(want.active ?? false);
    }
  });

  it.each(RUN_STATUSES)("%s: four cards and at most one active", (status) => {
    const got = agentCards(input(run(status)));
    expect(got.map((c) => c.agent)).toEqual([
      "orchestrator",
      "develop",
      "testing",
      "human",
    ]);
    expect(got.filter((c) => c.active).length).toBeLessThanOrEqual(1);
  });

  it("shows the last model of each agent and marks the paid backup", () => {
    const got = agentCards(
      input(run("developing"), {
        tasks: developingTasks(),
        steps: [
          testingSteps(1, "groq:llama"),
          step({ taskId: 1, model: "gemini:gemini-3-flash", createdAt: at(2) }),
          step({
            taskId: 2,
            model: "anthropic:claude-sonnet",
            createdAt: at(3),
          }),
        ],
      }),
    );
    const develop = got.find((c) => c.agent === "develop")!;
    const testing = got.find((c) => c.agent === "testing")!;
    expect(develop.model).toBe("anthropic:claude-sonnet");
    expect(develop.paid).toBe(true);
    expect(testing.model).toBe("groq:llama");
    expect(testing.paid).toBe(false);
    expect(got.find((c) => c.agent === "human")!.model).toBeNull();
  });

  it("the active card counts from its last progress", () => {
    const got = agentCards(
      input(run("developing"), {
        tasks: developingTasks(),
        steps: [testingSteps(), step({ taskId: 1, createdAt: at(4) })],
      }),
    );
    const develop = got.find((c) => c.agent === "develop")!;
    expect(develop.since).toEqual(at(4));
    expect(got.find((c) => c.agent === "orchestrator")!.since).toBeNull();
  });

  it("a postponed step shows why on the active card", () => {
    const base = { tasks: developingTasks(), steps: [testingSteps()] };
    const overloaded = agentCards(
      input(run("developing"), { ...base, events: [event(1, "overloaded")] }),
    ).find((c) => c.active)!;
    expect(overloaded.postponed).toBe("Modelo saturado · se reanuda solo");

    const limited = agentCards(
      input(run("developing"), {
        ...base,
        events: [event(1, "rate_limited", { model: "gemini:flash" })],
      }),
    ).find((c) => c.active)!;
    expect(limited.postponed).toContain("Límite por minuto de gemini:flash");

    const resumed = agentCards(
      input(run("developing"), {
        ...base,
        events: [event(1, "overloaded"), event(2, "context")],
      }),
    ).find((c) => c.active)!;
    expect(resumed.postponed).toBeNull();
  });
});
