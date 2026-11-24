import { and, eq } from "drizzle-orm";
import type { Db } from "@/server/db/client";
import { runs } from "@/server/db/schema";
import { runIdFromBranch } from "@/server/github/config";
import type { Classified } from "@/server/pipeline/classify";
import { applyEvent } from "./engine";
import type { RunEvent } from "./machine";
import { appendEvent, type EventDraft } from "./store";

export type RunNotice = {
  /** Which run: by its branch, or the one waiting for this head sha (D22). */
  target: { runId: number } | { headSha: string };
  /** null: only a timeline note, no transition. */
  event: RunEvent | null;
  note: EventDraft;
};

const short = (sha: string) => sha.slice(0, 7);

/** What a classified GitHub event means for the runs. Pure. */
export function noticeFor(c: Classified): RunNotice | null {
  switch (c.kind) {
    case "pull_request": {
      const runId = runIdFromBranch(c.update.branch);
      if (runId === null || c.update.prState === "open") return null;
      const merged = c.update.prState === "merged";
      return {
        target: { runId },
        event: { type: merged ? "merged" : "pr_closed" },
        note: {
          actor: "github",
          kind: merged ? "merged" : "pr_closed",
          message: merged
            ? `PR #${c.update.prNumber} fusionado en GitHub.`
            : `PR #${c.update.prNumber} cerrado en GitHub sin fusionar.`,
        },
      };
    }
    case "deployment_status": {
      const { sha, deployState, previewUrl } = c.update;
      if (deployState === "success") {
        return {
          target: { headSha: sha },
          event: null,
          note: {
            actor: "github",
            kind: "preview",
            message: `Vista previa de ${short(sha)} lista. Esperando los tests E2E.`,
            data: { previewUrl },
          },
        };
      }
      if (deployState !== "failure" && deployState !== "error") return null;
      return {
        target: { headSha: sha },
        event: { type: "build_failed" },
        note: {
          actor: "github",
          kind: "build_failed",
          message: `El build de la vista previa de ${short(sha)} ha fallado.`,
        },
      };
    }
    case "workflow_run": {
      // A cancelled run was replaced by a newer commit: nothing to evaluate.
      if (c.run.conclusion === "cancelled") return null;
      return {
        target: { headSha: c.run.sha },
        event: { type: "report_ready" },
        note: {
          actor: "github",
          kind: "report",
          message: `Tests E2E de ${short(c.run.sha)} terminados (${c.run.conclusion}).`,
          data: { runUrl: c.run.runUrl },
        },
      };
    }
    case "ignored":
      return null;
  }
}

/**
 * Forwards a processed GitHub event to its run. Reports and previews only
 * count for the run waiting on that exact sha; older commits are ignored.
 */
export async function notifyRuns(db: Db, c: Classified): Promise<void> {
  const notice = noticeFor(c);
  if (!notice) return;

  let runId: number;
  let version: number | undefined;
  if ("runId" in notice.target) {
    runId = notice.target.runId;
  } else {
    const [run] = await db
      .select({ id: runs.id, version: runs.version })
      .from(runs)
      .where(
        and(
          eq(runs.headSha, notice.target.headSha),
          eq(runs.status, "awaiting_preview"),
        ),
      );
    if (!run) return;
    runId = run.id;
    version = run.version;
  }

  if (notice.event) {
    await applyEvent(runId, notice.event, [notice.note], version);
  } else if (version !== undefined) {
    await appendEvent(db, { id: runId, version }, notice.note);
  }
}
