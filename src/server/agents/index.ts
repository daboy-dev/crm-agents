import type { LLMProvider } from "@/server/llm/provider";
import {
  developOutputSchema,
  planSchema,
  verdictSchema,
  type DevelopInput,
  type DevelopOutput,
  type Plan,
  type PlanInput,
  type TestingInput,
  type TestingVerdict,
} from "./contracts";

// Prompts are placeholders until H4–H6; the mock reads `input` instead.

export function runOrchestrator(
  llm: LLMProvider,
  input: PlanInput,
): Promise<Plan> {
  return llm.generateObject({
    agent: "orchestrator",
    system:
      "Eres el orquestador. Divide la petición en tareas con criterios de aceptación.",
    prompt: JSON.stringify(input),
    input,
    schema: planSchema,
  });
}

export function runDevelop(
  llm: LLMProvider,
  input: DevelopInput,
): Promise<DevelopOutput> {
  return llm.generateObject({
    agent: "develop",
    system:
      "Eres Develop. Devuelve los archivos completos de la tarea y el mensaje de commit.",
    prompt: JSON.stringify(input),
    input,
    schema: developOutputSchema,
  });
}

export function runTesting(
  llm: LLMProvider,
  input: TestingInput,
): Promise<TestingVerdict> {
  return llm.generateObject({
    agent: "testing",
    system:
      "Eres Testing. Evalúa los criterios de aceptación con el informe E2E.",
    prompt: JSON.stringify(input),
    input,
    schema: verdictSchema,
  });
}
