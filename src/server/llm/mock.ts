import type {
  DevelopInput,
  DevelopOutput,
  Plan,
  PlanInput,
  Split,
  SplitInput,
  CriteriaSteps,
  ExplainInput,
  StepsInput,
  TestingExplanation,
} from "@/server/agents/contracts";
import type {
  CallMeta,
  GenerateRequest,
  Generated,
  LLMProvider,
} from "./provider";

/** Scenarios of the simulated agents (D24). */
export const MOCK_SCENARIOS = [
  "ok",
  "fail-once",
  "blocked",
  "forbidden",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export const isMockScenario = (value: unknown): value is MockScenario =>
  MOCK_SCENARIOS.includes(value as MockScenario);

/** The task the failing scenarios pick on. */
const TARGET_TASK = 2;

/** Where the mock criteria find their element. */
const MOCK_PAGES: Record<string, string> = {
  "clients-table": "/clientes",
  "invoices-table": "/facturas",
};

export function mockPlan(input: PlanInput): Plan {
  const revision =
    input.planRevision > 1 ? ` (revisión ${input.planRevision})` : "";
  const feedback = input.feedback
    ? ` Tiene en cuenta el feedback: «${input.feedback}».`
    : "";
  // An amend replan (D29) only adds one corrective task.
  const amend = input.mode === "amend";
  const positions = amend ? [1] : [1, 2];
  return {
    feasible: true,
    summary: `Plan simulado${revision} para: ${input.request}.${feedback}`,
    assumptions: ["MockProvider no cambia la app: solo escribe agent-runs/."],
    tasks: positions.map((n) => ({
      title: amend ? `Tarea correctiva ${n}` : `Tarea simulada ${n}`,
      description: `Escribe agent-runs/${input.runId}/task-${n}.md. No cambia la app.`,
      files: [`agent-runs/${input.runId}/task-${n}.md`],
      // Any file of the tree will do: the mock does not imitate anything.
      references: [
        input.context.tree.includes("AGENTS.md")
          ? "AGENTS.md"
          : (input.context.tree[0] ?? "AGENTS.md"),
      ],
      // Elements that already exist: the mock never changes the app (D38).
      acceptanceCriteria: [
        {
          id: `c${2 * n - 1}`,
          type: "e2e" as const,
          text: "La vista previa compila y /clientes muestra la tabla de clientes",
          testIds: ["clients-table"],
        },
        {
          id: `c${2 * n}`,
          type: "e2e" as const,
          text: "/facturas muestra la tabla de facturas",
          testIds: ["invoices-table"],
        },
      ],
    })),
  };
}

/** Halves the files and the criteria of the task (D34). */
export function mockSplit(input: SplitInput): Split {
  const { task } = input;
  const half = <T>(items: T[]) => Math.ceil(items.length / 2);
  const files = [
    task.files.slice(0, half(task.files)),
    task.files.slice(half(task.files)),
  ];
  const criteria = [
    task.acceptanceCriteria.slice(0, half(task.acceptanceCriteria)),
    task.acceptanceCriteria.slice(half(task.acceptanceCriteria)),
  ];
  return {
    reason:
      "División simulada: la mitad de los archivos y de los criterios en cada parte.",
    tasks: [0, 1].map((i) => ({
      title: `${task.title} (parte ${i + 1} de 2)`,
      description: task.description,
      files: files[i]!.length > 0 ? files[i]! : task.files,
      references: task.references,
      acceptanceCriteria: criteria[i]!,
    })),
  };
}

export function mockDevelop(
  input: DevelopInput,
  scenario: MockScenario,
): DevelopOutput {
  const n = input.task.position;
  const lines = [
    `# Run ${input.runId} · ${input.task.title}`,
    "",
    `- Petición: ${input.request}`,
    `- Iteración: ${input.iteration}`,
    `- Escenario: ${scenario}`,
  ];
  if (input.feedback) lines.push(`- Feedback anterior: ${input.feedback}`);
  // The criteria's data-testid already exist in the app (D38).
  lines.push(
    "",
    ...input.task.acceptanceCriteria.flatMap((c) =>
      c.testIds.map(
        (id) => `- ${c.id}: data-testid="${id}" (ya existe en la app)`,
      ),
    ),
  );
  const files = [
    {
      path: `agent-runs/${input.runId}/task-${n}.md`,
      content: lines.join("\n") + "\n",
    },
  ];
  if (scenario === "forbidden" && n === TARGET_TASK) {
    files.push({
      path: ".github/workflows/agent.yml",
      content: "# Develop must never write workflows (D16)\n",
    });
  }
  return {
    commitMessage: `chore(agent-runs): run ${input.runId} task ${n} (iteration ${input.iteration})`,
    files,
    notes: `Archivo simulado de la tarea ${n}; no cambia la app.`,
  };
}

/**
 * Steps that pass on any preview: open the page and see the element of the
 * criterion. The failing scenarios are scripted by the engine (D24, D39).
 */
export function mockSteps(input: StepsInput): CriteriaSteps {
  return {
    criteria: input.criteria.map((c) => ({
      id: c.id,
      steps: [
        { action: "goto", path: MOCK_PAGES[c.testIds[0] ?? ""] ?? "/clientes" },
        { action: "expectVisible", testId: c.testIds[0] ?? "page-title" },
      ],
    })),
  };
}

export function mockExplain(input: ExplainInput): TestingExplanation {
  return {
    criteria: input.failed.map((f) => ({
      key: f.key,
      task: f.task,
      verdict: "fail",
      reason: `Explicación simulada: ${f.error ?? "el criterio falla"}`,
      evidence: f.failedStep?.action ?? "",
    })),
    regressions: input.regressions.map((r) => ({
      test: r.title,
      task: input.tasks.at(-1)?.position ?? 1,
      reason: `Regresión simulada: ${r.error}`,
    })),
  };
}

/** Deterministic agents for CI and H3 (D8, D24). Reads the structured input. */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  constructor(private readonly scenario: MockScenario) {}

  async generateObject<T>(request: GenerateRequest<T>): Promise<Generated<T>> {
    await request.hooks?.beforeCall?.();
    const started = Date.now();
    const raw = (() => {
      switch (request.agent) {
        case "orchestrator":
          return (request.input as { mode?: string }).mode === "split"
            ? mockSplit(request.input as SplitInput)
            : mockPlan(request.input as PlanInput);
        case "develop":
          return mockDevelop(request.input as DevelopInput, this.scenario);
        case "testing": {
          const input = request.input as { mode?: string };
          return input.mode === "explain"
            ? mockExplain(request.input as ExplainInput)
            : mockSteps(request.input as StepsInput);
        }
      }
    })();
    // Same validation path as a real provider.
    const output = request.schema.parse(raw);
    const call: CallMeta = {
      model: "mock",
      kind: "first",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - started,
      valid: true,
    };
    await request.hooks?.onCall?.(call);
    return { output, calls: [call] };
  }
}
