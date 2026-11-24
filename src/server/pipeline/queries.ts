import { count, desc, inArray, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import {
  githubEvents,
  previews,
  screenshots,
  testReports,
} from "@/server/db/schema";

export type PipelineScreenshot = { id: number; page: string; width: number };
export type PipelineReport = typeof testReports.$inferSelect & {
  screenshots: PipelineScreenshot[];
};
export type PipelineCommit = typeof previews.$inferSelect & {
  report: PipelineReport | null;
};
export type PipelinePr = {
  number: number;
  title: string | null;
  branch: string | null;
  state: string | null;
  /** Newest commit first. */
  commits: PipelineCommit[];
};

const MAX_PRS = 20;

/** Pull requests with their commits, previews, latest test report and screenshots. */
export async function getPipeline(db: Db): Promise<PipelinePr[]> {
  const rows = await db
    .select()
    .from(previews)
    .where(isNotNull(previews.prNumber))
    .orderBy(desc(previews.prNumber), desc(previews.createdAt));

  const prs = new Map<number, PipelinePr>();
  for (const row of rows) {
    const number = row.prNumber!;
    let pr = prs.get(number);
    if (!pr) {
      if (prs.size >= MAX_PRS) continue;
      pr = { number, title: null, branch: null, state: null, commits: [] };
      prs.set(number, pr);
    }
    pr.title ??= row.prTitle;
    pr.branch ??= row.branch;
    pr.state ??= row.prState;
    pr.commits.push({ ...row, report: null });
  }

  const shas = [...prs.values()].flatMap((pr) => pr.commits.map((c) => c.sha));
  if (shas.length === 0) return [];

  const reports = await db
    .select()
    .from(testReports)
    .where(inArray(testReports.sha, shas))
    .orderBy(desc(testReports.completedAt), desc(testReports.runAttempt));
  const latest = new Map<string, PipelineReport>();
  for (const report of reports) {
    if (!latest.has(report.sha)) {
      latest.set(report.sha, { ...report, screenshots: [] });
    }
  }

  const reportIds = [...latest.values()].map((r) => r.id);
  if (reportIds.length > 0) {
    const shots = await db
      .select({
        id: screenshots.id,
        reportId: screenshots.reportId,
        page: screenshots.page,
        width: screenshots.width,
      })
      .from(screenshots)
      .where(inArray(screenshots.reportId, reportIds))
      .orderBy(screenshots.page);
    const byReport = new Map(
      [...latest.values()].map((r) => [r.id, r] as const),
    );
    for (const { reportId, ...shot } of shots) {
      byReport.get(reportId)?.screenshots.push(shot);
    }
  }

  for (const pr of prs.values()) {
    for (const commit of pr.commits) {
      commit.report = latest.get(commit.sha) ?? null;
    }
  }
  return [...prs.values()];
}

/** Events waiting to be processed (never processed or failed). */
export async function getPendingEvents(db: Db) {
  const [row] = await db
    .select({ pending: count() })
    .from(githubEvents)
    .where(isNull(githubEvents.processedAt));
  const [lastError] = await db
    .select({ event: githubEvents.event, error: githubEvents.error })
    .from(githubEvents)
    .where(isNull(githubEvents.processedAt))
    .orderBy(desc(githubEvents.id))
    .limit(1);
  return {
    pending: row?.pending ?? 0,
    lastError: lastError?.error
      ? `${lastError.event}: ${lastError.error}`
      : null,
  };
}
