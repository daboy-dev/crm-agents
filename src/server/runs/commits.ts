import { normalizeContent } from "@/server/agents/files";
import type { DevelopOutput } from "@/server/agents/contracts";
import { breakTestId } from "@/server/agents/test-ids";
import type { FileWrite } from "@/server/github/repo";
import type { EventDraft } from "./store";

/** Appended to a file of the first commit when the run asks for it (H5). */
export const SIMULATED_TYPE_ERROR =
  '\nexport const simulatedTypeError: number = "pr-check debe devolver este error";\n';

/** What prepareCommits needs of each task's output. */
export type Prepared = {
  task: { position: number; iteration: number };
  output: Pick<DevelopOutput, "files">;
};

/**
 * Files of each task as they will be committed: line endings normalized and
 * a final newline (D34). Tasks whose files are all unchanged get no commit.
 * The type error of the H5 simulation goes into the first task here, so a
 * retried step builds the same chain.
 */
export async function prepareCommits<T extends Prepared>(
  outputs: T[],
  readFile: (path: string) => Promise<string | null>,
  options: {
    simulateTypeError: boolean;
    /**
     * H6 (D40): data-testid of the task whose first literal use is renamed,
     * so its criterion fails on the preview. Empty when not simulating.
     */
    breakTestIds?: (result: T) => readonly string[];
  },
) {
  const current = new Map<string, string | null>();
  const read = async (path: string) => {
    if (!current.has(path)) current.set(path, await readFile(path));
    return current.get(path) ?? null;
  };
  const notes: EventDraft[] = [];
  const changed: (T & { files: FileWrite[] })[] = [];
  const unchanged: T[] = [];
  let broken = false;
  for (const [i, result] of outputs.entries()) {
    let files = result.output.files.map((f) => ({
      path: f.path,
      content: normalizeContent(f.content),
    }));
    if (options.simulateTypeError && i === 0 && result.task.iteration === 1) {
      const target = files.find((f) => /\.tsx?$/.test(f.path));
      if (target) {
        files = files.map((f) =>
          f === target
            ? { ...f, content: f.content + SIMULATED_TYPE_ERROR }
            : f,
        );
        notes.push({
          actor: "system",
          kind: "simulation",
          message: `Simulación: error de tipos añadido a ${target.path} en la tarea ${result.task.position}.`,
        });
      } else {
        notes.push({
          actor: "system",
          kind: "simulation",
          message:
            "Simulación de error de tipos sin efecto: la primera tarea no escribe ningún archivo .ts o .tsx.",
        });
      }
    }
    const testIds = options.breakTestIds?.(result) ?? [];
    if (!broken && testIds.length > 0) {
      const done = breakTestId(files, testIds);
      if (done) {
        broken = true;
        files = done.files;
        notes.push({
          actor: "system",
          kind: "simulation",
          message: `Simulación: data-testid="${done.testId}" pasa a "${done.testId}-simulated" en la tarea ${result.task.position}, iteración ${result.task.iteration}. Su criterio debe fallar.`,
        });
      }
    }
    const same = await Promise.all(
      files.map(async (f) => {
        const before = await read(f.path);
        return before !== null && normalizeContent(before) === f.content;
      }),
    );
    // Later tasks build on these files.
    for (const f of files) current.set(f.path, f.content);
    if (same.every(Boolean)) unchanged.push(result);
    else changed.push({ ...result, files });
  }
  if (
    !broken &&
    outputs.some((o) => (options.breakTestIds?.(o) ?? []).length > 0)
  ) {
    notes.push({
      actor: "system",
      kind: "simulation",
      message:
        "Simulación de fallo de criterio sin efecto: Develop no escribe ningún data-testid del plan de forma literal.",
    });
  }
  return { changed, unchanged, notes };
}
