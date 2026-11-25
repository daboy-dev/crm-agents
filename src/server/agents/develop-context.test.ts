import { describe, expect, it, vi } from "vitest";
import {
  fitBudget,
  parseImports,
  readDevelopContext,
  resolveImport,
  type ContextFile,
  type RepoReader,
} from "./develop-context";
import { developPrompt } from "./prompts/develop";

const FILES: Record<string, string> = {
  "AGENTS.md": "# AGENTS",
  "src/db/schema.ts": "export const clients = {};",
  "src/app/(crm)/clientes/client-form.tsx": [
    'import { Field } from "@/components/field";',
    'import type { ClientInput } from "./validation";',
    'import { useActionState } from "react";',
    "export function ClientForm() {}",
  ].join("\n"),
  "src/app/(crm)/clientes/validation.ts":
    'import { z } from "zod";\nimport { money } from "@/lib/money";\nexport type ClientInput = {};',
  "src/app/(crm)/clientes/page.tsx":
    'import { getClients } from "./queries";\nexport default function Page() {}',
  "src/app/(crm)/clientes/queries.ts": "export async function getClients() {}",
  "src/components/field.tsx": "export function Field() {}",
  "src/components/index.ts": "export * from './field';",
  "src/lib/money.ts": "export const money = 1;",
  "agent-runs/3/task-1.md": "# old run",
};

function reader(files = FILES): RepoReader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    paths: vi.fn(async () => Object.keys(files)),
    text: vi.fn(async (path: string) => {
      reads.push(path);
      return files[path] ?? null;
    }),
  };
}

describe("parseImports", () => {
  it("finds static, type, side-effect, re-export and dynamic imports", () => {
    expect(
      parseImports(
        [
          'import a, { b } from "./a";',
          'import type { C } from "@/c";',
          'import "./side.css";',
          "export * from './d';",
          'const e = await import("../e");',
          'import {\n  f,\n  g,\n} from "./f";',
        ].join("\n"),
      ),
    ).toEqual(["./a", "@/c", "./d", "./f", "./side.css", "../e"]);
  });
});

describe("resolveImport", () => {
  const tree = new Set(Object.keys(FILES));
  const from = "src/app/(crm)/clientes/client-form.tsx";

  it("resolves @/ and relative paths with .ts, .tsx and index", () => {
    expect(resolveImport(from, "@/components/field", tree)).toBe(
      "src/components/field.tsx",
    );
    expect(resolveImport(from, "./validation", tree)).toBe(
      "src/app/(crm)/clientes/validation.ts",
    );
    expect(resolveImport(from, "@/components", tree)).toBe(
      "src/components/index.ts",
    );
    expect(resolveImport(from, "../../../lib/money", tree)).toBe(
      "src/lib/money.ts",
    );
  });

  it("ignores packages, missing files and paths out of the repo", () => {
    expect(resolveImport(from, "react", tree)).toBe(null);
    expect(resolveImport(from, "./nope", tree)).toBe(null);
    expect(resolveImport("a.ts", "../../x", tree)).toBe(null);
  });
});

describe("fitBudget (D32)", () => {
  const file = (path: string, role: ContextFile["role"], size: number) => ({
    path,
    role,
    content: "x".repeat(size),
  });

  it("drops imports first, then references, never planned or base files", () => {
    const files = [
      file("AGENTS.md", "base", 30),
      file("planned.ts", "planned", 60),
      file("ref1.ts", "reference", 20),
      file("ref2.ts", "reference", 20),
      file("imp1.ts", "import", 10),
      file("imp2.ts", "import", 10),
    ];
    expect(fitBudget(files, 200).trimmed).toEqual([]);
    expect(fitBudget(files, 130).trimmed).toEqual(["imp1.ts", "imp2.ts"]);
    expect(fitBudget(files, 110).trimmed).toEqual([
      "ref2.ts",
      "imp1.ts",
      "imp2.ts",
    ]);
    // Over budget with only base and planned left: they stay.
    expect(fitBudget(files, 10).files.map((f) => f.path)).toEqual([
      "AGENTS.md",
      "planned.ts",
    ]);
  });
});

describe("readDevelopContext (D32)", () => {
  const task = {
    files: [
      "src/app/(crm)/clientes/client-form.tsx",
      "src/app/(crm)/contacto/page.tsx",
    ],
    references: [
      "src/app/(crm)/clientes/page.tsx",
      "src/app/(crm)/clientes/client-form.tsx",
    ],
  };

  it("reads base, planned, references and one level of imports", async () => {
    const r = reader();
    const ctx = await readDevelopContext({ sha: "head1", task, reader: r });
    expect(ctx.files.map((f) => [f.path, f.role])).toEqual([
      ["AGENTS.md", "base"],
      ["src/db/schema.ts", "base"],
      ["src/app/(crm)/clientes/client-form.tsx", "planned"],
      ["src/app/(crm)/clientes/page.tsx", "reference"],
      ["src/components/field.tsx", "import"],
      ["src/app/(crm)/clientes/validation.ts", "import"],
      ["src/app/(crm)/clientes/queries.ts", "import"],
    ]);
    // validation.ts imports money.ts: a second level, not read.
    expect(r.reads).not.toContain("src/lib/money.ts");
    expect(ctx.newFiles).toEqual(["src/app/(crm)/contacto/page.tsx"]);
    expect(ctx.trimmed).toEqual([]);
    // The checks need the whole tree, agent-runs/ included.
    expect(ctx.tree).toContain("agent-runs/3/task-1.md");
    expect(r.paths).toHaveBeenCalledWith("head1");
  });

  it("sees the files of earlier tasks of the same step", async () => {
    const r = reader();
    const ctx = await readDevelopContext({
      sha: "head1",
      task: {
        files: ["src/app/(crm)/clientes/client-form.tsx"],
        references: ["src/lib/new-helper.ts"],
      },
      overlay: [
        {
          path: "src/app/(crm)/clientes/client-form.tsx",
          content: "// written by task 1",
        },
        { path: "src/lib/new-helper.ts", content: "export const h = 1;" },
      ],
      reader: r,
    });
    const byPath = Object.fromEntries(ctx.files.map((f) => [f.path, f]));
    expect(byPath["src/app/(crm)/clientes/client-form.tsx"]!.content).toBe(
      "// written by task 1",
    );
    expect(byPath["src/lib/new-helper.ts"]!.role).toBe("reference");
    expect(ctx.tree).toContain("src/lib/new-helper.ts");
    expect(r.reads).not.toContain("src/app/(crm)/clientes/client-form.tsx");
  });
});

describe("developPrompt", () => {
  it("lists the task, the files and the iteration feedback", async () => {
    const context = await readDevelopContext({
      sha: "head1234567",
      task: {
        files: ["src/app/(crm)/clientes/client-form.tsx"],
        references: ["src/app/(crm)/clientes/page.tsx"],
      },
      reader: reader(),
    });
    const prompt = developPrompt({
      runId: 7,
      request: "Añade el NIF",
      iteration: 2,
      feedback: "src/x.ts(1,1): error TS2322",
      task: {
        position: 1,
        title: "Campo NIF",
        description: "Añade field-nif",
        files: [
          "src/app/(crm)/clientes/client-form.tsx",
          "src/app/(crm)/clientes/nif.tsx",
        ],
        references: ["src/app/(crm)/clientes/page.tsx"],
        acceptanceCriteria: [
          { id: "c1", type: "e2e", text: "Se ve field-nif" },
        ],
      },
      context: { ...context, trimmed: ["src/lib/big.ts"] },
    });
    expect(prompt).toContain("## Tarea 1: Campo NIF");
    expect(prompt).toContain("- c1 (e2e): Se ve field-nif");
    expect(prompt).toContain(
      "- src/app/(crm)/clientes/client-form.tsx · existe, lo tienes abajo",
    );
    expect(prompt).toContain("## Iteración 2: corrige lo que falló");
    expect(prompt).toContain("error TS2322");
    expect(prompt).toContain(
      "### src/app/(crm)/clientes/page.tsx (referencia)\n````tsx",
    );
    expect(prompt).toContain("crm-demo en head123");
    expect(prompt).not.toContain("agent-runs/3/task-1.md");
    expect(prompt).toContain(
      "No se han incluido por tamaño (no los sobrescribas): src/lib/big.ts",
    );
  });
});
