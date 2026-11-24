import { describe, expect, it } from "vitest";
import type { Classified } from "@/server/pipeline/classify";
import { noticeFor } from "./notify";

const at = new Date("2026-11-24T10:00:00Z");
const pr = (
  branch: string,
  prState: "open" | "closed" | "merged",
): Classified => ({
  kind: "pull_request",
  update: {
    sha: "s",
    prNumber: 9,
    prTitle: "t",
    branch,
    prState,
    updatedAt: at,
  },
});
const deploy = (deployState: string): Classified => ({
  kind: "deployment_status",
  update: {
    sha: "abc1234def",
    previewUrl: "https://x.vercel.app",
    deployState,
    updatedAt: at,
  },
});
const workflow = (conclusion: string): Classified => ({
  kind: "workflow_run",
  run: {
    runId: 1,
    runAttempt: 1,
    sha: "abc1234def",
    branch: "run/7",
    prNumber: 9,
    conclusion,
    runUrl: "u",
    completedAt: at,
  },
});

describe("noticeFor", () => {
  it("a merged run PR finishes the run", () => {
    expect(noticeFor(pr("run/7", "merged"))).toMatchObject({
      target: { runId: 7 },
      event: { type: "merged" },
    });
  });

  it("a run PR closed without merge cancels it", () => {
    expect(noticeFor(pr("run/7", "closed"))?.event).toEqual({
      type: "pr_closed",
    });
  });

  it("ignores open PRs and branches that are not runs", () => {
    expect(noticeFor(pr("run/7", "open"))).toBeNull();
    expect(noticeFor(pr("feature/x", "closed"))).toBeNull();
  });

  it("a failed deployment is only a note: Vercel may still succeed", () => {
    expect(noticeFor(deploy("failure"))).toMatchObject({
      target: { headSha: "abc1234def" },
      event: null,
      note: { kind: "deploy_failure" },
    });
    expect(noticeFor(deploy("error"))?.event).toBeNull();
  });

  it("a ready preview is only a note", () => {
    expect(noticeFor(deploy("success"))).toMatchObject({ event: null });
    expect(noticeFor(deploy("in_progress"))).toBeNull();
  });

  it("a finished E2E run starts testing, unless it was cancelled", () => {
    expect(noticeFor(workflow("failure"))?.event).toEqual({
      type: "report_ready",
    });
    expect(noticeFor(workflow("success"))?.event).toEqual({
      type: "report_ready",
    });
    expect(noticeFor(workflow("cancelled"))).toBeNull();
  });

  it("ignored events stay ignored", () => {
    expect(noticeFor({ kind: "ignored", reason: "x" })).toBeNull();
  });
});
