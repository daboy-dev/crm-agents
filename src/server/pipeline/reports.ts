import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { screenshots, testReports } from "@/server/db/schema";
import { downloadArtifact, findRunArtifact } from "@/server/github/client";
import { E2E_ARTIFACT_NAME } from "@/server/github/config";
import { readArtifactZip, type TestSummary } from "./artifact";
import type { PreviewRun } from "./classify";
import { linkRunToPreview } from "./previews";

type ReportValues = Partial<TestSummary> & {
  status: "passed" | "failed" | "cancelled" | "error";
  error?: string | null;
};

/** Upserts the report of one run attempt; a repeat overwrites the same row. */
async function saveReport(db: Db, run: PreviewRun, values: ReportValues) {
  const row = {
    sha: run.sha,
    runId: run.runId,
    runAttempt: run.runAttempt,
    runUrl: run.runUrl,
    conclusion: run.conclusion,
    completedAt: run.completedAt,
    error: null,
    ...values,
  };
  const [saved] = await db
    .insert(testReports)
    .values(row)
    .onConflictDoUpdate({
      target: [testReports.runId, testReports.runAttempt],
      set: row,
    })
    .returning({ id: testReports.id });
  if (!saved) throw new Error("test report not saved");
  return saved.id;
}

/** Blob pathname: fixed per run attempt, so a repeat overwrites instead of adding. */
export function screenshotPathname(
  run: Pick<PreviewRun, "sha" | "runId" | "runAttempt">,
  page: string,
  width: number,
): string {
  return `screenshots/${run.sha}/${run.runId}-${run.runAttempt}/${page}-${width}.jpg`;
}

/**
 * Handles a completed preview-e2e.yml run (D16): downloads e2e-results with
 * the PAT, stores the report and uploads the screenshots to the private Blob
 * store. Idempotent: the report and screenshot rows are upserted and the blob
 * paths are fixed; screenshots already stored are not uploaded again.
 */
export async function handlePreviewRun(db: Db, run: PreviewRun) {
  await linkRunToPreview(db, run);

  if (run.conclusion === "cancelled") {
    await saveReport(db, run, { status: "cancelled" });
    return;
  }

  const artifact = await findRunArtifact(run.runId, E2E_ARTIFACT_NAME);
  if (!artifact) {
    const error = `Artifact ${E2E_ARTIFACT_NAME} not found`;
    await saveReport(db, run, { status: "error", error });
    throw new Error(error);
  }

  const {
    meta,
    results,
    screenshots: shots,
  } = readArtifactZip(await downloadArtifact(artifact));
  // The artifact is produced by code Develop can change: trust GitHub's run
  // data and only use meta.json as a consistency check.
  if (meta.sha !== run.sha || meta.run_id !== run.runId) {
    const error = "meta.json does not match the workflow run";
    await saveReport(db, run, { status: "error", error });
    throw new Error(error);
  }

  const status =
    results.failed > 0 || run.conclusion !== "success" ? "failed" : "passed";
  const reportId = await saveReport(db, run, { status, ...results });

  const stored = await db
    .select({
      page: screenshots.page,
      width: screenshots.width,
      size: screenshots.size,
    })
    .from(screenshots)
    .where(eq(screenshots.reportId, reportId));
  const isStored = (page: string, width: number, size: number) =>
    stored.some((s) => s.page === page && s.width === width && s.size === size);

  for (const shot of shots) {
    if (isStored(shot.page, shot.width, shot.data.byteLength)) continue;
    const pathname = screenshotPathname(run, shot.page, shot.width);
    await put(pathname, Buffer.from(shot.data), {
      access: "private",
      contentType: "image/jpeg",
      allowOverwrite: true,
      addRandomSuffix: false,
    });
    await db
      .insert(screenshots)
      .values({
        reportId,
        page: shot.page,
        width: shot.width,
        pathname,
        size: shot.data.byteLength,
      })
      .onConflictDoUpdate({
        target: [screenshots.reportId, screenshots.page, screenshots.width],
        set: { pathname, size: shot.data.byteLength },
      });
  }
}
