import { describe, expect, it, vi } from "vitest";
import { prepareCommits, SIMULATED_TYPE_ERROR } from "./commits";

const result = (
  position: number,
  files: Record<string, string>,
  iteration = 1,
) => ({
  task: { position, iteration },
  output: {
    files: Object.entries(files).map(([path, content]) => ({ path, content })),
  },
});

const repo: Record<string, string> = {
  "src/a.ts": "export const a = 1;\n",
  "README.md": "# demo\n",
};
const readFile = vi.fn(async (path: string) => repo[path] ?? null);
const none = { simulateTypeError: false };

describe("prepareCommits (D34)", () => {
  it("normalizes line endings and adds the final newline", async () => {
    const { changed } = await prepareCommits(
      [result(1, { "src/b.ts": "a\r\nb" })],
      readFile,
      none,
    );
    expect(changed[0]!.files).toEqual([
      { path: "src/b.ts", content: "a\nb\n" },
    ]);
  });

  it("a task whose files are all the same gets no commit", async () => {
    const { changed, unchanged } = await prepareCommits(
      [
        result(1, { "src/a.ts": "export const a = 1;\r\n" }, 2),
        result(2, { "src/a.ts": "export const a = 2;" }, 2),
      ],
      readFile,
      none,
    );
    expect(unchanged.map((r) => r.task.position)).toEqual([1]);
    expect(changed.map((r) => r.task.position)).toEqual([2]);
  });

  it("compares a task with what the earlier tasks wrote", async () => {
    const { unchanged } = await prepareCommits(
      [result(1, { "src/new.ts": "x" }), result(2, { "src/new.ts": "x\n" })],
      readFile,
      none,
    );
    expect(unchanged.map((r) => r.task.position)).toEqual([2]);
  });

  it("the simulation adds a type error to the first .ts file of task 1, iteration 1", async () => {
    const out = await prepareCommits(
      [
        result(1, { "README.md": "# x", "src/a.ts": "export const a = 3;" }),
        result(2, { "src/c.ts": "c" }),
      ],
      readFile,
      { simulateTypeError: true },
    );
    expect(out.changed[0]!.files[1]!.content).toBe(
      "export const a = 3;\n" + SIMULATED_TYPE_ERROR,
    );
    expect(out.changed[1]!.files[0]!.content).toBe("c\n");
    expect(out.notes[0]!.message).toContain(
      "error de tipos añadido a src/a.ts",
    );

    const later = await prepareCommits(
      [result(1, { "src/a.ts": "export const a = 3;" }, 2)],
      readFile,
      { simulateTypeError: true },
    );
    expect(later.changed[0]!.files[0]!.content).not.toContain(
      "simulatedTypeError",
    );
    expect(later.notes).toEqual([]);
  });
});

describe("simulated criterion failure (D40)", () => {
  const filter = '<select data-testid="invoice-status-filter" />';
  it("renames one data-testid of the plan before the commit", async () => {
    const { changed, notes } = await prepareCommits(
      [result(1, { "src/f.tsx": filter }), result(2, { "src/g.tsx": filter })],
      readFile,
      { ...none, breakTestIds: () => ["invoice-status-filter"] },
    );
    expect(changed[0]!.files[0]!.content).toContain(
      'data-testid="invoice-status-filter-simulated"',
    );
    // Only one, so only one criterion fails.
    expect(changed[1]!.files[0]!.content).toContain(
      'data-testid="invoice-status-filter"',
    );
    expect(notes[0]!.message).toContain("Su criterio debe fallar");
  });

  it("says so when no data-testid is literal", async () => {
    const { notes } = await prepareCommits(
      [result(1, { "src/f.tsx": '<Field name="notes" />' })],
      readFile,
      { ...none, breakTestIds: () => ["field-notes"] },
    );
    expect(notes[0]!.message).toContain("sin efecto");
  });
});
