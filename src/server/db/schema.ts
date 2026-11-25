import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AgentName, Criterion } from "@/server/agents/contracts";
import type { CallMeta, ProviderName } from "@/server/llm/provider";

/** Key/value metadata about the app itself. Used by the health check. */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- H2 · Pipeline (D17). Tables relate by commit sha. ---

/** Every GitHub webhook delivery, append-only. Reprocessable while unprocessed or failed. */
export const githubEvents = pgTable(
  "github_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    deliveryId: text("delivery_id").notNull().unique(),
    event: text().notNull(),
    action: text(),
    payload: jsonb().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text(),
    attempts: integer().notNull().default(0),
  },
  (t) => [index("github_events_pending_idx").on(t.processedAt)],
);

/** One row per commit: its pull request and its Vercel preview. */
export const previews = pgTable(
  "previews",
  {
    sha: text().primaryKey(),
    prNumber: integer("pr_number"),
    prTitle: text("pr_title"),
    branch: text(),
    /** open | closed | merged */
    prState: text("pr_state"),
    prUpdatedAt: timestamp("pr_updated_at", { withTimezone: true }),
    previewUrl: text("preview_url"),
    /** GitHub deployment state: pending | in_progress | success | failure | error */
    deployState: text("deploy_state"),
    deployUpdatedAt: timestamp("deploy_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("previews_pr_number_idx").on(t.prNumber)],
);

export type TestFailure = { title: string; project: string; error: string };

/** Result of one run of preview-e2e.yml (one per run attempt). */
export const testReports = pgTable(
  "test_reports",
  {
    id: serial().primaryKey(),
    sha: text().notNull(),
    runId: bigint("run_id", { mode: "number" }).notNull(),
    runAttempt: integer("run_attempt").notNull(),
    runUrl: text("run_url").notNull(),
    /** GitHub workflow conclusion: success | failure | cancelled | … */
    conclusion: text().notNull(),
    /** passed | failed | cancelled | error (artifact missing or invalid) */
    status: text().notNull(),
    passed: integer().notNull().default(0),
    failed: integer().notNull().default(0),
    flaky: integer().notNull().default(0),
    skipped: integer().notNull().default(0),
    durationMs: integer("duration_ms"),
    failures: jsonb().$type<TestFailure[]>().notNull().default([]),
    error: text(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("test_reports_run_uq").on(t.runId, t.runAttempt),
    index("test_reports_sha_idx").on(t.sha),
  ],
);

/** Screenshot stored in the private Blob store. Served by /api/screenshots/[id]. */
export const screenshots = pgTable(
  "screenshots",
  {
    id: serial().primaryKey(),
    reportId: integer("report_id")
      .notNull()
      .references(() => testReports.id, { onDelete: "cascade" }),
    page: text().notNull(),
    width: integer().notNull(),
    pathname: text().notNull(),
    size: integer().notNull(),
  },
  (t) => [unique("screenshots_uq").on(t.reportId, t.page, t.width)],
);

// --- H3 · Runs (D20–D25). ---

/**
 * One request from the client, carried through plan → develop → test → merge.
 * Every transition is a compare-and-swap on `version` (D22).
 */
export const runs = pgTable(
  "runs",
  {
    id: serial().primaryKey(),
    request: text().notNull(),
    /** Summary of the providers, e.g. "gemini+mock" (see `providers`). */
    provider: text().notNull(),
    /** Provider of each agent, fixed when the run is created (D26). */
    providers: jsonb().$type<Record<AgentName, ProviderName>>(),
    /** MockProvider scenario (D24): ok | fail-once | blocked | forbidden */
    scenario: text(),
    /** Mock only: the develop step crashes once right after moving the ref. */
    simulateCrash: boolean("simulate_crash").notNull().default(false),
    crashedAt: timestamp("crashed_at", { withTimezone: true }),
    /** The planning step crashes once right after storing the plan (H4). */
    simulatePlanCrash: boolean("simulate_plan_crash").notNull().default(false),
    planCrashedAt: timestamp("plan_crashed_at", { withTimezone: true }),
    /** See RunStatus in src/server/runs/machine.ts. */
    status: text().notNull().default("queued"),
    version: integer().notNull().default(0),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Status to resume when a blocked run is retried. */
    blockedFrom: text("blocked_from"),
    blockedReason: text("blocked_reason"),
    /** Bumped every time client feedback sends the run back to planning. */
    planRevision: integer("plan_revision").notNull().default(1),
    feedback: text(),
    planSummary: text("plan_summary"),
    planAssumptions: jsonb("plan_assumptions").$type<string[]>(),
    /** Why the orchestrator found the request not feasible (D28). */
    rejectedReason: text("rejected_reason"),
    /** master sha the orchestrator read; base of run/<id> (D27). */
    baseSha: text("base_sha"),
    /** crm-demo files the orchestrator read, shown in the UI (D27). */
    contextPaths: jsonb("context_paths").$type<string[]>(),
    /** Branch head the panel last pushed; previews and reports must match it. */
    headSha: text("head_sha"),
    /** Commit chain built but not yet pointed to by the ref (D22). */
    targetSha: text("target_sha"),
    targetCommits: jsonb("target_commits").$type<Record<string, string>>(),
    prNumber: integer("pr_number"),
    prUrl: text("pr_url"),
    /** The PR still has to be closed and the branch deleted. */
    cleanupPending: boolean("cleanup_pending").notNull().default(false),
    llmCalls: integer("llm_calls").notNull().default(0),
    /** Failed attempts of the current step; reset on every transition. */
    stepAttempts: integer("step_attempts").notNull().default(0),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    leaseToken: text("lease_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("runs_status_idx").on(t.status),
    index("runs_head_sha_idx").on(t.headSha),
    // A single active run (D11, D23): every status but queued and the final ones.
    uniqueIndex("runs_one_active_uq")
      .on(sql`(true)`)
      .where(
        sql`${t.status} not in ('queued', 'done', 'rejected', 'cancelled', 'failed')`,
      ),
  ],
);

/** One task of a plan revision. Develop makes one commit per task (D20). */
export const tasks = pgTable(
  "tasks",
  {
    id: serial().primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    planRevision: integer("plan_revision").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    /** Files the task expects to touch, checked against paths.ts (D28). */
    files: jsonb().$type<string[]>().notNull().default([]),
    /** Existing files Develop imitates (extra of D28, D32). */
    references: jsonb().$type<string[]>().notNull().default([]),
    acceptanceCriteria: jsonb("acceptance_criteria")
      .$type<Criterion[]>()
      .notNull(),
    /** pending | developing | testing | passed | failed | blocked */
    status: text().notNull().default("pending"),
    iteration: integer().notNull().default(0),
    maxIterations: integer("max_iterations").notNull().default(3),
    lastFeedback: text("last_feedback"),
    commitSha: text("commit_sha"),
  },
  (t) => [unique("tasks_uq").on(t.runId, t.planRevision, t.position)],
);

/** Append-only timeline of a run (D21). */
export const runEvents = pgTable(
  "run_events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    /** Run version this event belongs to. */
    runVersion: integer("run_version").notNull(),
    /** orchestrator | develop | testing | human | system | github */
    actor: text().notNull(),
    kind: text().notNull(),
    message: text().notNull(),
    data: jsonb(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("run_events_run_idx").on(t.runId, t.id)],
);

/**
 * Validated output of one LLM call. A retried step reads it instead of
 * calling the LLM again (D22).
 */
export const agentSteps = pgTable(
  "agent_steps",
  {
    id: serial().primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    /** null for the orchestrator, whose iteration is the plan revision. */
    taskId: integer("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    iteration: integer().notNull(),
    /** orchestrator | develop | testing */
    agent: text().notNull(),
    output: jsonb().notNull(),
    /** Model of the call that produced the output (D26). */
    model: text(),
    /** Totals over every call of the step, repair included. */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    calls: jsonb().$type<CallMeta[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("agent_steps_uq")
      .on(t.runId, t.taskId, t.iteration, t.agent)
      .nullsNotDistinct(),
  ],
);
