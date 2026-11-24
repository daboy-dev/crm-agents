import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { previews } from "@/server/db/schema";
import type { DeploymentUpdate, PullRequestUpdate } from "./classify";

/**
 * Applies a pull_request event. Idempotent and order-safe: a field group only
 * changes when the event is at least as recent as what is stored.
 */
export async function applyPullRequest(db: Db, u: PullRequestUpdate) {
  const pr = {
    prNumber: u.prNumber,
    prTitle: u.prTitle,
    branch: u.branch,
    prState: u.prState,
    prUpdatedAt: u.updatedAt,
  };
  await db
    .insert(previews)
    .values({ sha: u.sha, ...pr })
    .onConflictDoUpdate({
      target: previews.sha,
      set: pr,
      setWhere: or(
        isNull(previews.prUpdatedAt),
        lte(previews.prUpdatedAt, u.updatedAt),
      ),
    });

  // Title and state belong to the PR, so older commits of it follow too.
  await db
    .update(previews)
    .set({
      prTitle: u.prTitle,
      prState: u.prState,
      prUpdatedAt: u.updatedAt,
    })
    .where(
      and(
        eq(previews.prNumber, u.prNumber),
        or(
          isNull(previews.prUpdatedAt),
          lte(previews.prUpdatedAt, u.updatedAt),
        ),
      ),
    );
}

/** Applies a deployment_status event for a preview. Same rules as above. */
export async function applyDeployment(db: Db, u: DeploymentUpdate) {
  const deploy = {
    previewUrl: u.previewUrl,
    deployState: u.deployState,
    deployUpdatedAt: u.updatedAt,
  };
  await db
    .insert(previews)
    .values({ sha: u.sha, ...deploy })
    .onConflictDoUpdate({
      target: previews.sha,
      set: deploy,
      setWhere: or(
        isNull(previews.deployUpdatedAt),
        lte(previews.deployUpdatedAt, u.updatedAt),
      ),
    });
}

/** Fills the PR and branch of a commit from a workflow run, if still unknown. */
export async function linkRunToPreview(
  db: Db,
  run: { sha: string; branch: string | null; prNumber: number | null },
) {
  await db
    .insert(previews)
    .values({ sha: run.sha, branch: run.branch, prNumber: run.prNumber })
    .onConflictDoUpdate({
      target: previews.sha,
      set: {
        branch: sql`coalesce(${previews.branch}, excluded.branch)`,
        prNumber: sql`coalesce(${previews.prNumber}, excluded.pr_number)`,
      },
    });
}
