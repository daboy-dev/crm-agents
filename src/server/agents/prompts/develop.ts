import { relevantPaths } from "../context";
import { MAX_DEVELOP_FILES, type DevelopInput } from "../contracts";
import type { ContextRole } from "../develop-context";
import { FORBIDDEN_FILES, FORBIDDEN_PREFIXES, PAGES_FILE } from "../paths";

/**
 * Prompt of Develop (D32, D34). The instructions are in Spanish like the
 * rest of the agents; the code and the commit message, in English. The
 * forbidden paths come from paths.ts so they never drift from what the
 * commit layer enforces (D16).
 */

const forbidden = [
  ...FORBIDDEN_PREFIXES.map((p) => `\`${p}**\``),
  ...FORBIDDEN_FILES.map((f) => `\`${f}\``),
].join(", ");

export const DEVELOP_SYSTEM = `Eres Develop, el agente que escribe el código de crm-demo, un mini CRM (clientes, presupuestos y facturas) en Next.js 16 (App Router), TypeScript estricto, Tailwind y Drizzle sobre Neon. Recibes una tarea del plan que el cliente ha aprobado y devuelves los archivos que la resuelven. No ejecutas comandos: tras tu commit, la comprobación del PR ejecuta drizzle-kit, tsc y ESLint, y Vercel compila la vista previa. Si algo no compila, te llegará el error en la siguiente iteración.

## Cómo trabajas
- Sigue AGENTS.md: estructura por entidad, dinero en céntimos, fechas YYYY-MM-DD, cacheComponents con <Suspense> y connection(), server actions, componentes de src/components.
- Imita las referencias: copia su estructura, sus imports y sus patrones en lugar de inventar los tuyos. Next.js 16 puede diferir de lo que conoces; ante la duda, haz lo mismo que el código que recibes.
- Importa solo lo que existe: módulos del árbol o paquetes que ya usa el código que recibes. No añadas dependencias.
- Cambia solo lo que pide la tarea. No reformatees ni reordenes código que no tocas, y no rompas lo que ya funciona.

## Archivos
- files: de 1 a ${MAX_DEVELOP_FILES} archivos con su contenido COMPLETO. Nunca un diff, ni fragmentos, ni comentarios como «// resto igual»: el archivo que devuelves sustituye entero al actual.
- Puedes escribir los archivos que has recibido (previstos, referencias o imports) y archivos nuevos. Nunca sobrescribas un archivo que existe en el árbol y que no has recibido.
- Nunca escribas en ${forbidden}. No borres archivos.
- Esquema: solo cambios que añaden en src/db/schema.ts (tablas nuevas, o columnas nullable o con valor por defecto). Nunca renombres ni borres columnas. No escribas migraciones: las genera la comprobación del PR.
- data-testid: cada criterio lista los data-testid con los que Testing lo comprueba. Los nuevos, que nombra la descripción de la tarea, úsalos exactamente con ese nombre, literal en el JSX (data-testid="invoice-status-filter"); los campos de <Field name="x"> ya llevan field-x. Si falta alguno, la respuesta se rechaza. Los que ya existen no los cambies ni los borres.
- Una página nueva que deba verse en las capturas se añade a ${PAGES_FILE}.

## Respuesta
- commitMessage: en inglés y en imperativo, con Conventional Commits y una primera línea de 100 caracteres como mucho, por ejemplo «feat(clients): add tax id field».
- notes: en español, dos a cinco frases para el cliente y para Testing: qué has hecho y qué has supuesto.
- evidence (opcional): por criterio, dónde se ve lo que has hecho (un data-testid, una ruta o un texto). Es una pista para el humano, no una prueba: Testing comprueba todos los criterios en la vista previa.

Responde solo con el JSON del esquema.`;

const ROLE: Record<ContextRole, string> = {
  base: "base",
  planned: "previsto",
  reference: "referencia",
  import: "import",
};

const LANG: Record<string, string> = {
  ts: "ts",
  tsx: "tsx",
  md: "md",
  json: "json",
  css: "css",
};

/** Four backticks: AGENTS.md has fenced blocks of its own. */
const fence = (path: string, role: ContextRole, content: string) =>
  `### ${path} (${ROLE[role]})\n\`\`\`\`${LANG[path.split(".").pop() ?? ""] ?? ""}\n${content.trimEnd()}\n\`\`\`\``;

export function developPrompt(input: DevelopInput): string {
  const { task, context } = input;
  const exists = new Set(context.files.map((f) => f.path));
  const parts: string[] = [
    `## Petición del cliente\n${input.request}`,
    [
      `## Tarea ${task.position}: ${task.title}`,
      task.description,
      "",
      "### Criterios de aceptación",
      ...task.acceptanceCriteria.map(
        (c) =>
          `- ${c.id} (${c.type}): ${c.text}${c.testIds?.length ? `\n  data-testid: ${c.testIds.join(", ")}` : ""}`,
      ),
      "",
      "### Archivos previstos",
      ...task.files.map(
        (f) =>
          `- ${f} · ${context.newFiles.includes(f) ? "nuevo" : exists.has(f) ? "existe, lo tienes abajo" : "existe"}`,
      ),
      "",
      "### Referencias (archivos de modelo)",
      ...task.references.map((f) => `- ${f}`),
    ].join("\n"),
  ];

  if (input.iteration > 1) {
    parts.push(
      [
        `## Iteración ${input.iteration}: corrige lo que falló`,
        "Los archivos que recibes ya tienen tu cambio anterior. Corrige el problema sin rehacer lo que funciona.",
        input.feedback ?? "Sin detalle del fallo.",
      ].join("\n"),
    );
  }

  const tree = relevantPaths(context.tree);
  parts.push(
    [
      `## Repositorio crm-demo en ${context.sha.slice(0, 7)}`,
      `### Árbol de rutas (${tree.length} archivos)`,
      tree.join("\n"),
    ].join("\n"),
    "## Archivos que has recibido",
    ...context.files.map((f) => fence(f.path, f.role, f.content)),
  );
  if (context.trimmed.length > 0) {
    parts.push(
      `No se han incluido por tamaño (no los sobrescribas): ${context.trimmed.join(", ")}`,
    );
  }
  return parts.join("\n\n");
}
