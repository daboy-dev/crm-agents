/**
 * Paths Develop may never write (D16, D24): the workflows and the e2e helpers
 * run with crm-demo's secrets. Listed in crm-demo's AGENTS.md.
 */
export const FORBIDDEN_PREFIXES = [".github/"];
export const FORBIDDEN_FILES = ["e2e/helpers.ts", "e2e/screenshots.spec.ts"];

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
      FORBIDDEN_FILES.includes(lower)
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
