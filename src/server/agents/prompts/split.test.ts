import { describe, expect, it } from "vitest";
import { runSplit } from "@/server/agents";
import type { SplitInput } from "@/server/agents/contracts";
import { MockProvider } from "@/server/llm/mock";
import { splitPrompt } from "./split";

const input = (over: Partial<SplitInput> = {}): SplitInput => ({
  runId: 7,
  request: "Añade el NIF a los clientes",
  mode: "split",
  planRevision: 2,
  task: {
    position: 2,
    title: "NIF en el formulario, la lista y el detalle",
    description: "Añade field-nif y muestra el NIF",
    files: [
      "src/app/(crm)/clientes/client-form.tsx",
      "src/app/(crm)/clientes/page.tsx",
      "src/app/(crm)/clientes/[id]/page.tsx",
    ],
    references: ["src/app/(crm)/clientes/client-form.tsx"],
    acceptanceCriteria: [
      {
        id: "c2",
        type: "e2e",
        text: "El formulario tiene field-nif",
        testIds: ["clients-table"],
      },
      {
        id: "c3",
        type: "visual",
        text: "La lista muestra el NIF",
        testIds: ["clients-table"],
      },
      {
        id: "c4",
        type: "e2e",
        text: "El detalle muestra client-nif",
        testIds: ["clients-table"],
      },
    ],
  },
  reason:
    "gemini:gemini-3.8-flash: la respuesta se ha cortado al llegar a 32768 tokens de salida",
  others: [{ position: 1, title: "Columna nif", files: ["src/db/schema.ts"] }],
  maxTasks: 3,
  context: {
    baseSha: "abc1234def",
    tree: [
      "AGENTS.md",
      "src/db/schema.ts",
      "src/app/(crm)/clientes/client-form.tsx",
      "src/app/(crm)/clientes/page.tsx",
      "src/app/(crm)/clientes/[id]/page.tsx",
    ],
    files: [{ path: "AGENTS.md", content: "# AGENTS" }],
  },
  ...over,
});

describe("split (D34)", () => {
  it("the prompt carries the task, its criteria to copy and the limit", () => {
    const prompt = splitPrompt(input());
    expect(prompt).toContain("## Tarea que hay que dividir (tarea 2)");
    expect(prompt).toContain("- c3 (visual): La lista muestra el NIF");
    expect(prompt).toContain(
      "Divide en 2 subtareas como mínimo y 3 como máximo.",
    );
    expect(prompt).toContain("- Tarea 1 · Columna nif · src/db/schema.ts");
    expect(prompt).toContain("32768 tokens");
  });

  it("the mock splits files and criteria in two valid halves", async () => {
    const { output } = await runSplit(new MockProvider("ok"), input());
    expect(
      output.tasks.map((t) => t.acceptanceCriteria.map((c) => c.id)),
    ).toEqual([["c2", "c3"], ["c4"]]);
    expect(output.tasks[1]!.files).toEqual([
      "src/app/(crm)/clientes/[id]/page.tsx",
    ]);
  });
});
