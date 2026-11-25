import type { SplitInput } from "../contracts";
import { FORBIDDEN_FILES, FORBIDDEN_PREFIXES } from "../paths";

/**
 * Prompt of the orchestrator when Develop's answer did not fit (D34). The
 * criteria are shared out but never change, so the client is not asked
 * again: the scope it approved is the same.
 */

const forbidden = [
  ...FORBIDDEN_PREFIXES.map((p) => `\`${p}**\``),
  ...FORBIDDEN_FILES.map((f) => `\`${f}\``),
].join(", ");

export const SPLIT_SYSTEM = `Eres el Orquestador de un equipo de agentes que modifica crm-demo, un mini CRM en Next.js 16, TypeScript, Tailwind y Drizzle. Una tarea del plan que el cliente aprobó no ha cabido en la respuesta de Develop: devuelve los archivos completos y se ha cortado al llegar a su límite de tokens de salida. Divídela en subtareas más pequeñas que, aplicadas en orden y una por commit, hagan lo mismo que la original.

## Reglas
- tasks: de 2 al máximo que se indica, en el orden en que se aplican. Cada subtarea escribe pocos archivos, idealmente de 1 a 3, y no repite un archivo grande de otra subtarea salvo que sea imprescindible.
- Criterios: cada criterio de la tarea original va, copiado tal cual (el mismo id, type y text), a exactamente una subtarea: la que lo deja comprobable. No añadas, cambies ni repitas criterios. Una subtarea puede quedarse sin criterios.
- files: rutas exactas del repositorio. Nunca ${forbidden}. Un cambio de esquema solo toca src/db/schema.ts; la migración la genera la comprobación del PR.
- references: de 1 a 3 archivos que ya existen en el árbol y sirven de modelo; puedes reutilizar los de la tarea original.
- description: instrucciones concretas para Develop, en español, con rutas y data-testid, como en el plan original.
- reason: cómo has dividido la tarea y por qué, en una o dos frases en español.

Responde solo con el JSON del esquema.`;

const fence = (path: string, content: string) =>
  `### ${path}\n\`\`\`\`\n${content.trimEnd()}\n\`\`\`\``;

export function splitPrompt(input: SplitInput): string {
  const { task, context } = input;
  return [
    `## Petición del cliente\n${input.request}`,
    [
      `## Tarea que hay que dividir (tarea ${task.position}): ${task.title}`,
      task.description,
      "",
      `Archivos: ${task.files.join(", ")}`,
      `Referencias: ${task.references.join(", ")}`,
      "Criterios (cópialos tal cual):",
      ...task.acceptanceCriteria.map((c) => `- ${c.id} (${c.type}): ${c.text}`),
      "",
      `Motivo: ${input.reason}`,
      `Divide en 2 subtareas como mínimo y ${input.maxTasks} como máximo.`,
    ].join("\n"),
    [
      "## Resto del plan (no cambia)",
      ...(input.others.length > 0
        ? input.others.map(
            (t) => `- Tarea ${t.position} · ${t.title} · ${t.files.join(", ")}`,
          )
        : ["- Ninguna otra tarea."]),
    ].join("\n"),
    [
      `## Repositorio crm-demo en ${context.baseSha.slice(0, 7)}`,
      `### Árbol de rutas (${context.tree.length} archivos)`,
      context.tree.join("\n"),
    ].join("\n"),
    ...context.files.map((f) => fence(f.path, f.content)),
  ].join("\n\n");
}
