import type {
  DevelopInput,
  DevelopOutput,
  Plan,
  PlanInput,
  TestingInput,
  TestingVerdict,
} from "@/server/agents/contracts";
import type { GenerateRequest, LLMProvider } from "./provider";

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
      acceptanceCriteria: [
        {
          id: `c${2 * n - 1}`,
          type: "e2e" as const,
          text: `Existe agent-runs/${input.runId}/task-${n}.md`,
        },
        {
          id: `c${2 * n}`,
          type: "e2e" as const,
          text: "Los tests E2E de la vista previa pasan",
        },
      ],
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
  };
}

export function mockVerdict(
  input: TestingInput,
  scenario: MockScenario,
): TestingVerdict {
  const target = input.task.position === TARGET_TASK;
  const scripted =
    target &&
    ((scenario === "fail-once" && input.iteration === 1) ||
      scenario === "blocked");
  const e2eFailed = input.report.status !== "passed";

  const criteria = input.task.acceptanceCriteria.map((c, i) => {
    const base = { id: c.id, criterion: c.text };
    if (e2eFailed && i === input.task.acceptanceCriteria.length - 1) {
      return {
        ...base,
        passed: false,
        note: `El E2E real ha fallado: ${input.report.failed} tests con fallos`,
      };
    }
    if (scripted && i === 0) {
      return {
        ...base,
        passed: false,
        note: `Fallo simulado por el escenario ${scenario}`,
      };
    }
    return { ...base, passed: true, note: "Cumplido" };
  });
  const passed = criteria.every((c) => c.passed);
  return {
    passed,
    summary: passed
      ? "Todos los criterios se cumplen"
      : criteria
          .filter((c) => !c.passed)
          .map((c) => c.note)
          .join(". "),
    criteria,
  };
}

/** Deterministic agents for CI and H3 (D8, D24). Reads the structured input. */
export class MockProvider implements LLMProvider {
  readonly name = "mock";
  constructor(private readonly scenario: MockScenario) {}

  async generateObject<T>(request: GenerateRequest<T>): Promise<T> {
    const output = (() => {
      switch (request.agent) {
        case "orchestrator":
          return mockPlan(request.input as PlanInput);
        case "develop":
          return mockDevelop(request.input as DevelopInput, this.scenario);
        case "testing":
          return mockVerdict(request.input as TestingInput, this.scenario);
      }
    })();
    // Same validation path as a real provider.
    return request.schema.parse(output);
  }
}
