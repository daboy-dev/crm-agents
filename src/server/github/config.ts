/** The only repository the panel listens to and reads from (D3). */
export const DEMO_REPO = "daboy-dev/crm-demo";

/** Workflow whose runs carry the e2e-results artifact (D15, D16). */
export const PREVIEW_WORKFLOW_PATH = ".github/workflows/preview-e2e.yml";

export const E2E_ARTIFACT_NAME = "e2e-results";

/** crm-demo's production branch, where approved runs are merged. */
export const BASE_BRANCH = "master";

/** One branch per run, named after its id so a retried step reuses it (D20). */
export const runBranch = (runId: number) => `run/${runId}`;

/** Parses run/<id>; null for any other branch. */
export function runIdFromBranch(
  branch: string | null | undefined,
): number | null {
  const match = /^run\/(\d+)$/.exec(branch ?? "");
  return match ? Number(match[1]) : null;
}
