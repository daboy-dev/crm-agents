import { z } from "zod";

/**
 * Agent contracts (D8, D24). Every LLM output is validated against these
 * schemas; from H4 on only the provider and the prompts change.
 */

export const AGENTS = ["orchestrator", "develop", "testing"] as const;
export type AgentName = (typeof AGENTS)[number];

// --- Orchestrator ---

export const planSchema = z.object({
  summary: z.string().min(1).max(2000),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(2000),
        acceptanceCriteria: z.array(z.string().min(1).max(300)).min(1).max(8),
      }),
    )
    .min(1)
    .max(5),
});
export type Plan = z.infer<typeof planSchema>;

export type PlanInput = {
  runId: number;
  request: string;
  planRevision: number;
  /** Client feedback on the previous plan or preview (D9). */
  feedback: string | null;
  previousSummary: string | null;
};

// --- Develop ---

export const developOutputSchema = z.object({
  commitMessage: z.string().min(1).max(200),
  /** Complete file contents: the panel never applies diffs. */
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        content: z.string().max(200_000),
      }),
    )
    .min(1)
    .max(20),
});
export type DevelopOutput = z.infer<typeof developOutputSchema>;

export type TaskBrief = {
  position: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
};

export type DevelopInput = {
  runId: number;
  request: string;
  task: TaskBrief;
  iteration: number;
  /** Testing feedback from the previous iteration. */
  feedback: string | null;
};

// --- Testing ---

export const verdictSchema = z.object({
  passed: z.boolean(),
  summary: z.string().min(1).max(2000),
  criteria: z.array(
    z.object({
      criterion: z.string(),
      passed: z.boolean(),
      note: z.string().max(1000),
    }),
  ),
});
export type TestingVerdict = z.infer<typeof verdictSchema>;

export type E2eSummary = {
  /** passed | failed | error (see test_reports.status) */
  status: string;
  passed: number;
  failed: number;
  failures: { title: string; project: string; error: string }[];
};

export type TestingInput = {
  runId: number;
  task: TaskBrief;
  iteration: number;
  report: E2eSummary;
};
