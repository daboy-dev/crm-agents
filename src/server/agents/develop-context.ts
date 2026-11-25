import { getFilePaths, getFileText } from "@/server/github/repo";
import type { TaskBrief } from "./contracts";

/**
 * What Develop reads from crm-demo for one task (D32): the conventions, the
 * schema, the planned files that exist, the references and their local
 * imports one level deep. Everything at the head of run/<id>, plus the
 * outputs of the earlier tasks of the same step, which are not committed yet.
 */

/** Always in the prompt: how to work and the data model. */
export const BASE_FILES = ["AGENTS.md", "src/db/schema.ts"];

/** About 150 KB of file contents (D32): imports go first, then references. */
export const CONTEXT_BUDGET_BYTES = 150 * 1024;

export type ContextRole = "base" | "planned" | "reference" | "import";

export type ContextFile = { path: string; role: ContextRole; content: string };

export type DevelopContext = {
  /** Sha of run/<id> (or the base sha before the first push) read. */
  sha: string;
  /**
   * Every path at that sha plus the files of earlier tasks of the step. The
   * prompt leaves out agent-runs/ (relevantPaths), the checks do not.
   */
  tree: string[];
  files: ContextFile[];
  /** Planned files that do not exist yet: Develop creates them. */
  newFiles: string[];
  /** Left out to keep within the budget. */
  trimmed: string[];
};

/** Reads the repo; GitHub in the app, a map in the tests. */
export type RepoReader = {
  paths(sha: string): Promise<string[]>;
  text(path: string, sha: string): Promise<string | null>;
};

export const githubReader: RepoReader = {
  paths: getFilePaths,
  text: getFileText,
};

const SOURCE_RE = /\.(ts|tsx)$/;

/**
 * Module specifiers of a TS source: static imports and exports, side-effect
 * imports and dynamic imports with a literal.
 */
export function parseImports(source: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^"'`;]*?\sfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) specs.add(m[1]!);
  }
  return [...specs];
}

function normalize(parts: string[]): string | null {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return out.join("/");
}

/**
 * Resolves a local specifier (relative or @/) to a path of the tree, trying
 * .ts, .tsx and index files. Packages and anything else return null.
 */
export function resolveImport(
  from: string,
  spec: string,
  tree: ReadonlySet<string>,
): string | null {
  let base: string | null;
  if (spec.startsWith("@/"))
    base = normalize(["src", ...spec.slice(2).split("/")]);
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    base = normalize([...from.split("/").slice(0, -1), ...spec.split("/")]);
  } else return null;
  if (!base) return null;
  const candidates = SOURCE_RE.test(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((c) => tree.has(c)) ?? null;
}

const bytes = (text: string) => new TextEncoder().encode(text).length;

/**
 * Drops imports, then references, from the end until the files fit the
 * budget. Base and planned files are never dropped (D32).
 */
export function fitBudget(
  files: ContextFile[],
  budget = CONTEXT_BUDGET_BYTES,
): { files: ContextFile[]; trimmed: string[] } {
  const kept = [...files];
  const trimmed: string[] = [];
  let total = kept.reduce((n, f) => n + bytes(f.content), 0);
  for (const role of ["import", "reference"] as const) {
    for (let i = kept.length - 1; i >= 0 && total > budget; i--) {
      const file = kept[i]!;
      if (file.role !== role) continue;
      total -= bytes(file.content);
      trimmed.unshift(file.path);
      kept.splice(i, 1);
    }
  }
  return { files: kept, trimmed };
}

export async function readDevelopContext(options: {
  sha: string;
  task: Pick<TaskBrief, "files" | "references">;
  /** Files written by the earlier tasks of this step, in order. */
  overlay?: { path: string; content: string }[];
  reader?: RepoReader;
}): Promise<DevelopContext> {
  const { sha, task, reader = githubReader } = options;
  const overlay = new Map(
    (options.overlay ?? []).map((f) => [f.path, f.content]),
  );
  const tree = [...new Set([...(await reader.paths(sha)), ...overlay.keys()])];
  const inTree = new Set(tree);

  const cache = new Map<string, Promise<string | null>>();
  const read = (path: string) => {
    if (overlay.has(path)) return Promise.resolve(overlay.get(path)!);
    if (!cache.has(path)) cache.set(path, reader.text(path, sha));
    return cache.get(path)!;
  };

  const files: ContextFile[] = [];
  const added = new Set<string>();
  /** Reads a group in parallel and keeps its order. */
  const addAll = async (paths: string[], role: ContextRole) => {
    const fresh = paths.filter((p) => {
      if (added.has(p) || !inTree.has(p)) return false;
      added.add(p);
      return true;
    });
    const contents = await Promise.all(fresh.map(read));
    fresh.forEach((path, i) => {
      const content = contents[i];
      if (content != null) files.push({ path, role, content });
    });
  };

  await addAll(BASE_FILES, "base");
  await addAll(task.files, "planned");
  await addAll(task.references, "reference");

  // One level of local imports of the planned files and the references.
  const imports = files
    .filter(
      (f) =>
        (f.role === "planned" || f.role === "reference") &&
        SOURCE_RE.test(f.path),
    )
    .flatMap((source) =>
      parseImports(source.content).flatMap(
        (spec) => resolveImport(source.path, spec, inTree) ?? [],
      ),
    );
  await addAll(imports, "import");

  const fitted = fitBudget(files);
  return {
    sha,
    tree,
    files: fitted.files,
    newFiles: task.files.filter((f) => !inTree.has(f)),
    trimmed: fitted.trimmed,
  };
}
