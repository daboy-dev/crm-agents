import { getFilePaths, getFileText } from "@/server/github/repo";
import type { PlanContext } from "./contracts";
import { PAGES_FILE } from "./paths";

/**
 * What the orchestrator reads from crm-demo (D27): the conventions, the
 * schema and the captured pages. It plans, it does not program, so it never
 * gets the whole code.
 */
export const CONTEXT_FILES = ["AGENTS.md", "src/db/schema.ts", PAGES_FILE];

/** agent-runs/ grows with every simulated run and tells nothing about the app. */
const IGNORED_PREFIXES = ["agent-runs/"];

export const relevantPaths = (paths: string[]) =>
  paths.filter((p) => !IGNORED_PREFIXES.some((prefix) => p.startsWith(prefix)));

/** Reads the context at a fixed sha, so every revision plans on the same base. */
export async function readPlanContext(baseSha: string): Promise<PlanContext> {
  const tree = relevantPaths(await getFilePaths(baseSha));
  const files = await Promise.all(
    CONTEXT_FILES.filter((f) => tree.includes(f)).map(async (path) => ({
      path,
      content: (await getFileText(path, baseSha)) ?? "",
    })),
  );
  return { baseSha, tree, files };
}
