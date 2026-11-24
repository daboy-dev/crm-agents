import { describe, expect, it } from "vitest";
import type { PlanInput } from "../contracts";
import { ORCHESTRATOR_SYSTEM, orchestratorPrompt } from "./orchestrator";

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  runId: 7,
  request: "Añade el NIF a los clientes",
  planRevision: 1,
  mode: "replace",
  feedback: null,
  previous: null,
  context: {
    baseSha: "0123456789abcdef",
    tree: ["AGENTS.md", "src/db/schema.ts"],
    files: [{ path: "AGENTS.md", content: "# AGENTS.md · crm-demo\n" }],
  },
  ...over,
});

const previous = {
  summary: "NIF en clientes",
  tasks: [
    {
      position: 1,
      title: "Columna nif",
      status: "passed",
      lastFeedback: null,
      acceptanceCriteria: [
        { id: "c1", type: "e2e" as const, text: "Se ve field-nif" },
      ],
    },
  ],
};

describe("orchestrator prompt", () => {
  it("states the scope rules with the paths of paths.ts", () => {
    for (const path of [
      "`.github/**`",
      "`e2e/helpers.ts`",
      "`e2e/screenshots.spec.ts`",
      "e2e/pages.ts",
    ]) {
      expect(ORCHESTRATOR_SYSTEM).toContain(path);
    }
    expect(ORCHESTRATOR_SYSTEM).toContain("feasible: false");
    expect(ORCHESTRATOR_SYSTEM).toContain("De 1 a 4 tareas");
    expect(ORCHESTRATOR_SYSTEM).toContain(
      "Nunca escribas criterios sobre el código",
    );
  });

  it("a first plan has the request and the context", () => {
    const prompt = orchestratorPrompt(input());
    expect(prompt).toContain("Añade el NIF a los clientes");
    expect(prompt).toContain("crm-demo en 0123456");
    expect(prompt).toContain(
      "Árbol de rutas (2 archivos)\nAGENTS.md\nsrc/db/schema.ts",
    );
    expect(prompt).toContain("### AGENTS.md\n```\n# AGENTS.md · crm-demo\n```");
    expect(prompt).not.toContain("Replanificación");
  });

  it("plan feedback asks for a full plan that replaces the previous one", () => {
    const prompt = orchestratorPrompt(
      input({ planRevision: 2, feedback: "Hazlo obligatorio", previous }),
    );
    expect(prompt).toContain("Replanificación del plan (revisión 2)");
    expect(prompt).toContain("plan completo que lo sustituye");
    expect(prompt).toContain("## Feedback del cliente\nHazlo obligatorio");
  });

  it("preview feedback asks only for new or corrective tasks (D29)", () => {
    const prompt = orchestratorPrompt(
      input({
        planRevision: 3,
        mode: "amend",
        feedback: "El NIF debe salir en la lista",
        previous: {
          ...previous,
          tasks: [{ ...previous.tasks[0]!, lastFeedback: "Falta en móvil" }],
        },
      }),
    );
    expect(prompt).toContain("tras la vista previa (revisión 3)");
    expect(prompt).toContain("solo tareas nuevas o correctivas");
    expect(prompt).toContain("Tarea 1 · Columna nif · estado: passed");
    expect(prompt).toContain("c1 (e2e): Se ve field-nif");
    expect(prompt).toContain("Último feedback de Testing: Falta en móvil");
    expect(prompt).toContain("El NIF debe salir en la lista");
  });
});
