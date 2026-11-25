/**
 * Paths Develop may never write, all listed in crm-demo's AGENTS.md:
 * - The workflows and the e2e helpers, which run with crm-demo's secrets (D16).
 * - The criteria runner and its JSON files: the steps come from the approved
 *   criteria, never from Develop (D38).
 * - drizzle/: migrations are written by pr-check, never by the LLM (D31).
 * - package.json and the lockfile: Develop cannot update the lockfile (D31).
 * - The build, lint and test config: changing it could hide the errors that
 *   pr-check sends back to Develop (D33).
 * - AGENTS.md and CLAUDE.md: Develop reads them on every task, so rewriting
 *   them would change the instructions of later runs (D32).
 */
export const FORBIDDEN_PREFIXES = [".github/", "drizzle/", "e2e/criteria/"];
export const FORBIDDEN_FILES = [
  "e2e/helpers.ts",
  "e2e/screenshots.spec.ts",
  "e2e/criteria.spec.ts",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "drizzle.config.ts",
  "next.config.ts",
  "tsconfig.json",
  "eslint.config.mjs",
  "playwright.config.ts",
  "vitest.config.ts",
  "AGENTS.md",
  "CLAUDE.md",
];

/** List of captured pages: a task that creates a page adds it here (D28). */
export const PAGES_FILE = "e2e/pages.ts";

export type PathCheck =
  { ok: true } | { ok: false; path: string; reason: string };

/** Normalizes a repo-relative path, or returns null when it is not one. */
export function normalizePath(path: string): string | null {
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) {
    return null;
  }
  const parts = path.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return null;
  return parts.join("/");
}

/** Rejects the whole change when any file is outside what Develop may touch. */
export function checkPaths(paths: string[]): PathCheck {
  for (const path of paths) {
    const normalized = normalizePath(path);
    if (!normalized) {
      return { ok: false, path, reason: `Ruta no válida: ${path}` };
    }
    const lower = normalized.toLowerCase();
    if (
      FORBIDDEN_PREFIXES.some((p) => lower.startsWith(p)) ||
      FORBIDDEN_FILES.some((f) => f.toLowerCase() === lower)
    ) {
      return {
        ok: false,
        path,
        reason: `Develop no puede modificar ${normalized} (D16)`,
      };
    }
  }
  const unique = new Set(paths.map((p) => normalizePath(p)));
  if (unique.size !== paths.length) {
    return { ok: false, path: paths[0] ?? "", reason: "Rutas repetidas" };
  }
  return { ok: true };
}
