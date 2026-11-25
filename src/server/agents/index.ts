import type { CallHooks, Generated, LLMProvider } from "@/server/llm/provider";
import { DEVELOP_SYSTEM, developPrompt } from "./prompts/develop";
import {
  ORCHESTRATOR_SYSTEM,
  orchestratorPrompt,
} from "./prompts/orchestrator";
import {
  developSchemaFor,
  planSchemaFor,
  verdictSchema,
  type DevelopInput,
  type DevelopOutput,
  type Plan,
  type PlanInput,
  type TestingInput,
  type TestingVerdict,
} from "./contracts";

// The Testing prompt is a placeholder until H6; the mock reads `input`.

export function runOrchestrator(
  llm: LLMProvider,
  input: PlanInput,
  hooks?: CallHooks,
): Promise<Generated<Plan>> {
  return llm.generateObject({
    agent: "orchestrator",
    system: ORCHESTRATOR_SYSTEM,
    prompt: orchestratorPrompt(input),
    input,
    hooks,
    // With the tree: a new page must be added to e2e/pages.ts (D28).
    schema: planSchemaFor(input.context.tree),
  });
}

export function runDevelop(
  llm: LLMProvider,
  input: DevelopInput,
  hooks?: CallHooks,
): Promise<Generated<DevelopOutput>> {
  const { context, task } = input;
  return llm.generateObject({
    agent: "develop",
    system: DEVELOP_SYSTEM,
    prompt: developPrompt(input),
    input,
    hooks,
    // D34: never an existing file it has not seen.
    schema: developSchemaFor({
      tree: context.tree,
      seen: context.files.map((f) => f.path),
      criteria: task.acceptanceCriteria.map((c) => c.id),
    }),
  });
}

export function runTesting(
  llm: LLMProvider,
  input: TestingInput,
  hooks?: CallHooks,
): Promise<Generated<TestingVerdict>> {
  return llm.generateObject({
    agent: "testing",
    system:
      "Eres Testing. Evalúa los criterios de aceptación con el informe E2E.",
    prompt: JSON.stringify(input),
    input,
    hooks,
    schema: verdictSchema,
  });
}
