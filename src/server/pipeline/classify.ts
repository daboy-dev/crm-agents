import { z } from "zod";
import { DEMO_REPO, PREVIEW_WORKFLOW_PATH } from "@/server/github/config";

const repository = z.object({ full_name: z.string() });
const timestamp = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s));

const pullRequestEvent = z.object({
  action: z.string(),
  repository,
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean().nullish(),
    updated_at: timestamp,
    head: z.object({ ref: z.string(), sha: z.string() }),
  }),
});

const deploymentStatusEvent = z.object({
  repository,
  deployment: z.object({ sha: z.string(), environment: z.string() }),
  deployment_status: z.object({
    state: z.string(),
    target_url: z.string().nullish(),
    environment_url: z.string().nullish(),
    updated_at: timestamp,
  }),
});

const workflowRunEvent = z.object({
  action: z.string(),
  repository,
  workflow_run: z.object({
    id: z.number().int(),
    run_attempt: z.number().int(),
    path: z.string(),
    head_sha: z.string(),
    head_branch: z.string().nullish(),
    conclusion: z.string().nullish(),
    html_url: z.string(),
    updated_at: timestamp,
    pull_requests: z.array(z.object({ number: z.number().int() })).default([]),
  }),
});

export type PullRequestUpdate = {
  sha: string;
  prNumber: number;
  prTitle: string;
  branch: string;
  prState: "open" | "closed" | "merged";
  updatedAt: Date;
};

export type DeploymentUpdate = {
  sha: string;
  previewUrl: string | null;
  deployState: string;
  updatedAt: Date;
};

export type PreviewRun = {
  runId: number;
  runAttempt: number;
  sha: string;
  branch: string | null;
  prNumber: number | null;
  conclusion: string;
  runUrl: string;
  completedAt: Date;
};

export type Classified =
  | { kind: "pull_request"; update: PullRequestUpdate }
  | { kind: "deployment_status"; update: DeploymentUpdate }
  | { kind: "workflow_run"; run: PreviewRun }
  | { kind: "ignored"; reason: string };

const PR_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "edited",
  "closed",
]);

/** Deployment states worth showing. `inactive` only means a newer deployment replaced it. */
const DEPLOY_STATES = new Set([
  "pending",
  "queued",
  "in_progress",
  "success",
  "failure",
  "error",
]);

const ignored = (reason: string): Classified => ({ kind: "ignored", reason });

/**
 * Decides what a stored GitHub event means for the pipeline. Only events from
 * crm-demo count; CI and neon-cleanup workflow runs, pushes and pings are
 * ignored.
 */
export function classifyEvent(event: string, payload: unknown): Classified {
  const repo = repository.safeParse(
    (payload as { repository?: unknown } | null)?.repository,
  );
  if (!repo.success || repo.data.full_name !== DEMO_REPO) {
    return ignored("other repository");
  }

  switch (event) {
    case "pull_request": {
      const { action, pull_request: pr } = pullRequestEvent.parse(payload);
      if (!PR_ACTIONS.has(action)) return ignored(`pull_request ${action}`);
      return {
        kind: "pull_request",
        update: {
          sha: pr.head.sha,
          prNumber: pr.number,
          prTitle: pr.title,
          branch: pr.head.ref,
          prState: pr.merged ? "merged" : pr.state,
          updatedAt: pr.updated_at,
        },
      };
    }
    case "deployment_status": {
      const { deployment, deployment_status: status } =
        deploymentStatusEvent.parse(payload);
      if (!deployment.environment.startsWith("Preview")) {
        return ignored(`environment ${deployment.environment}`);
      }
      if (!DEPLOY_STATES.has(status.state)) {
        return ignored(`deployment ${status.state}`);
      }
      return {
        kind: "deployment_status",
        update: {
          sha: deployment.sha,
          previewUrl: status.target_url || status.environment_url || null,
          deployState: status.state,
          updatedAt: status.updated_at,
        },
      };
    }
    case "workflow_run": {
      const { action, workflow_run: run } = workflowRunEvent.parse(payload);
      // GitHub may append "@<ref>" to the path.
      if (run.path.split("@")[0] !== PREVIEW_WORKFLOW_PATH) {
        return ignored(`workflow ${run.path}`);
      }
      if (action !== "completed") return ignored(`workflow_run ${action}`);
      // Production deployments also start the workflow; its jobs are skipped.
      if (run.conclusion === "skipped") return ignored("workflow_run skipped");
      return {
        kind: "workflow_run",
        run: {
          runId: run.id,
          runAttempt: run.run_attempt,
          sha: run.head_sha,
          branch: run.head_branch ?? null,
          prNumber: run.pull_requests[0]?.number ?? null,
          conclusion: run.conclusion ?? "unknown",
          runUrl: run.html_url,
          completedAt: run.updated_at,
        },
      };
    }
    default:
      return ignored(`event ${event}`);
  }
}
