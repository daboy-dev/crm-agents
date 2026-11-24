import {
  bigint,
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

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
