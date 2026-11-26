import type { CallHooks, Generated, LLMProvider } from "@/server/llm/provider";
import { DEVELOP_SYSTEM, developPrompt } from "./prompts/develop";
import { SPLIT_SYSTEM, splitPrompt } from "./prompts/split";
import {
  EXPLAIN_SYSTEM,
  explainPrompt,
  STEPS_SYSTEM,
  stepsPrompt,
} from "./prompts/testing";
import {
  ORCHESTRATOR_SYSTEM,
  orchestratorPrompt,
} from "./prompts/orchestrator";
import {
  developSchemaFor,
  planSchemaFor,
  splitSchemaFor,
  stepsSchemaFor,
  explainSchemaFor,
  type Split,
  type SplitInput,
  type DevelopInput,
  type DevelopOutput,
  type Plan,
  type PlanInput,
  type CriteriaSteps,
  type ExplainInput,
  type StepsInput,
  type TaskBrief,
  type TestingExplanation,
} from "./contracts";

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

/** Splits a task whose Develop answer did not fit (D34). */
export function runSplit(
  llm: LLMProvider,
  input: SplitInput,
  hooks?: CallHooks,
): Promise<Generated<Split>> {
  return llm.generateObject({
    agent: "orchestrator",
    system: SPLIT_SYSTEM,
    prompt: splitPrompt(input),
    input,
    hooks,
    schema: splitSchemaFor(input.task, input.context.tree, input.maxTasks),
  });
}

/**
 * The data-testid Develop must write: those of the task's criteria that its
 * description names, which is where the plan puts the new ones (D38). An
 * existing one, like nav-clientes, lives in a file the task may not touch
 * (run #21).
 */
export function requiredTestIds(task: TaskBrief): string[] {
  const named = (id: string) =>
    new RegExp(`(^|[^a-z0-9-])${id}([^a-z0-9-]|$)`).test(task.description);
  return [...new Set(task.acceptanceCriteria.flatMap((c) => c.testIds))].filter(
    named,
  );
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
      current: Object.fromEntries(
        context.files.map((f) => [f.path, f.content]),
      ),
      requireChange: input.iteration === 1,
      testIds: requiredTestIds(task),
    }),
  });
}

/** Steps of the e2e criteria of one plan revision (D38). */
export function runTestingSteps(
  llm: LLMProvider,
  input: StepsInput,
  hooks?: CallHooks,
): Promise<Generated<CriteriaSteps>> {
  return llm.generateObject({
    agent: "testing",
    system: STEPS_SYSTEM,
    prompt: stepsPrompt(input),
    input: { mode: "steps", ...input },
    hooks,
    schema: stepsSchemaFor({ criteria: input.criteria, pages: input.pages }),
  });
}

/** Explains the failures of a report; the runner already decided them (D39). */
export function runTestingExplain(
  llm: LLMProvider,
  input: ExplainInput,
  hooks?: CallHooks,
): Promise<Generated<TestingExplanation>> {
  return llm.generateObject({
    agent: "testing",
    system: EXPLAIN_SYSTEM,
    prompt: explainPrompt(input),
    input: { mode: "explain", ...input },
    hooks,
    schema: explainSchemaFor(input),
  });
}
