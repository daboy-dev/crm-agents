import type { CallHooks, Generated, LLMProvider } from "@/server/llm/provider";
import {
  ORCHESTRATOR_SYSTEM,
  orchestratorPrompt,
} from "./prompts/orchestrator";
import {
  developOutputSchema,
  planSchemaFor,
  verdictSchema,
  type DevelopInput,
  type DevelopOutput,
  type Plan,
  type PlanInput,
  type TestingInput,
  type TestingVerdict,
} from "./contracts";

// Develop and Testing prompts are placeholders until H5 and H6; the mock
// reads `input` instead.

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
  return llm.generateObject({
    agent: "develop",
    system:
      "Eres Develop. Devuelve los archivos completos de la tarea y el mensaje de commit.",
    prompt: JSON.stringify(input),
    input,
    hooks,
    schema: developOutputSchema,
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
