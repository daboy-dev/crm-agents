import { describe, expect, it } from "vitest";
import { classifyEvent } from "./classify";

const repository = { full_name: "daboy-dev/crm-demo" };
const SHA = "6c2bb79bba387eb6724303d924bcc8d4f867607c";

function pullRequest(
  overrides: Record<string, unknown> = {},
  action = "opened",
) {
  return {
    action,
    repository,
    pull_request: {
      number: 3,
      title: "ci: run Playwright against Vercel previews",
      state: "open",
      merged: false,
      updated_at: "2026-11-24T13:20:00Z",
      head: { ref: "ci/preview-e2e", sha: SHA },
      ...overrides,
    },
  };
}

function deploymentStatus(state = "success", environment = "Preview") {
  return {
    repository,
    deployment: { sha: SHA, environment },
    deployment_status: {
      state,
      target_url: "https://crm-demo-abc123-daboy-dev.vercel.app",
      environment_url: "https://crm-demo-abc123-daboy-dev.vercel.app",
      updated_at: "2026-11-24T13:22:00Z",
    },
  };
}

function workflowRun(
  path = ".github/workflows/preview-e2e.yml",
  action = "completed",
) {
  return {
    action,
    repository,
    workflow_run: {
      id: 45403048280,
      run_attempt: 1,
      path,
      head_sha: SHA,
      head_branch: "ci/preview-e2e",
      conclusion: "success",
      html_url:
        "https://github.com/daboy-dev/crm-demo/actions/runs/45403048280",
      updated_at: "2026-11-24T13:26:00Z",
      pull_requests: [{ number: 3 }],
    },
  };
}

describe("classifyEvent · pull_request", () => {
  it("extracts PR, branch, sha and state", () => {
    expect(classifyEvent("pull_request", pullRequest())).toEqual({
      kind: "pull_request",
      update: {
        sha: SHA,
        prNumber: 3,
        prTitle: "ci: run Playwright against Vercel previews",
        branch: "ci/preview-e2e",
        prState: "open",
        updatedAt: new Date("2026-11-24T13:20:00Z"),
      },
    });
  });

  it("reports a merged PR as merged", () => {
    const result = classifyEvent(
      "pull_request",
      pullRequest({ state: "closed", merged: true }, "closed"),
    );
    expect(result).toMatchObject({ update: { prState: "merged" } });
  });

  it("ignores actions that change nothing shown", () => {
    expect(classifyEvent("pull_request", pullRequest({}, "labeled")).kind).toBe(
      "ignored",
    );
  });
});

describe("classifyEvent · deployment_status", () => {
  it("extracts the preview URL and state", () => {
    expect(classifyEvent("deployment_status", deploymentStatus())).toEqual({
      kind: "deployment_status",
      update: {
        sha: SHA,
        previewUrl: "https://crm-demo-abc123-daboy-dev.vercel.app",
        deployState: "success",
        updatedAt: new Date("2026-11-24T13:22:00Z"),
      },
    });
  });

  it("accepts Vercel's environment with the project name", () => {
    expect(
      classifyEvent(
        "deployment_status",
        deploymentStatus("success", "Preview – crm-demo"),
      ).kind,
    ).toBe("deployment_status");
  });

  it("ignores production and inactive deployments", () => {
    expect(
      classifyEvent(
        "deployment_status",
        deploymentStatus("success", "Production"),
      ).kind,
    ).toBe("ignored");
    expect(
      classifyEvent("deployment_status", deploymentStatus("inactive")).kind,
    ).toBe("ignored");
  });
});

describe("classifyEvent · workflow_run filter", () => {
  it("keeps completed runs of preview-e2e.yml", () => {
    expect(classifyEvent("workflow_run", workflowRun())).toEqual({
      kind: "workflow_run",
      run: {
        runId: 45403048280,
        runAttempt: 1,
        sha: SHA,
        branch: "ci/preview-e2e",
        prNumber: 3,
        conclusion: "success",
        runUrl:
          "https://github.com/daboy-dev/crm-demo/actions/runs/45403048280",
        completedAt: new Date("2026-11-24T13:26:00Z"),
      },
    });
  });

  it("accepts a path with a ref suffix", () => {
    expect(
      classifyEvent(
        "workflow_run",
        workflowRun(".github/workflows/preview-e2e.yml@refs/heads/master"),
      ).kind,
    ).toBe("workflow_run");
  });

  it.each([
    ".github/workflows/ci.yml",
    ".github/workflows/neon-cleanup.yml",
    ".github/workflows/preview-e2e.yml.bak",
  ])("ignores %s", (path) => {
    expect(classifyEvent("workflow_run", workflowRun(path)).kind).toBe(
      "ignored",
    );
  });

  it("ignores a run whose jobs were skipped (production deployment)", () => {
    const payload = workflowRun();
    payload.workflow_run.conclusion = "skipped";
    expect(classifyEvent("workflow_run", payload)).toEqual({
      kind: "ignored",
      reason: "workflow_run skipped",
    });
  });

  it.each(["requested", "in_progress"])("ignores action %s", (action) => {
    expect(
      classifyEvent(
        "workflow_run",
        workflowRun(".github/workflows/preview-e2e.yml", action),
      ).kind,
    ).toBe("ignored");
  });
});

describe("classifyEvent · other", () => {
  it("ignores other repositories", () => {
    const payload = {
      ...workflowRun(),
      repository: { full_name: "someone/else" },
    };
    expect(classifyEvent("workflow_run", payload).kind).toBe("ignored");
  });

  it.each(["push", "ping"])("ignores %s", (event) => {
    expect(classifyEvent(event, { repository }).kind).toBe("ignored");
  });

  it("throws on a malformed payload so the event is kept for review", () => {
    expect(() =>
      classifyEvent("pull_request", { action: "opened", repository }),
    ).toThrow();
  });
});
