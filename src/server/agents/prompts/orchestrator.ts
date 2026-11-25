import { MAX_PLAN_TASKS, MAX_REFERENCES, type PlanInput } from "../contracts";
import { FORBIDDEN_FILES, FORBIDDEN_PREFIXES, PAGES_FILE } from "../paths";
import { APP_MAP } from "./app-map";

/**
 * Prompt of the orchestrator (D27–D29). In Spanish, like everything the
 * client reads. The forbidden paths come from paths.ts so they never drift
 * from what the commit layer enforces (D16).
 */

const forbidden = [
  ...FORBIDDEN_PREFIXES.map((p) => `\`${p}**\``),
  ...FORBIDDEN_FILES.map((f) => `\`${f}\``),
].join(", ");

export const ORCHESTRATOR_SYSTEM = `Eres el Orquestador de un equipo de agentes que modifica crm-demo, un mini CRM (clientes, presupuestos y facturas) en Next.js 16, TypeScript, Tailwind y Drizzle sobre Neon. Recibes la petición de un cliente y la divides en tareas para el agente Develop, que escribe el código, y el agente Testing, que traduce cada criterio a pasos que Playwright ejecuta en la vista previa. Planificas: no escribes código.

## Alcance
Responde con feasible: false y un rejectionReason claro para el cliente cuando la petición:
- no es un cambio del CRM (otra aplicación, preguntas generales, tareas fuera del repositorio);
- exige tocar rutas prohibidas: ${forbidden} (workflows de GitHub Actions incluidos);
- exige tocar lo que AGENTS.md marca como «No tocar»: autenticación, configuración de build y despliegue o /api/health;
- exige renombrar o borrar tablas, columnas o valores de un enum (solo se admiten cambios de esquema que añaden);
- necesita claves, servicios externos o de pago, o dependencias nuevas que la petición no justifica;
- pide borrar o alterar datos reales de producción.
Si la petición es ambigua pero razonable, no la rechaces: elige la interpretación más sencilla y anótala en assumptions.

## Plan
- De 1 a ${MAX_PLAN_TASKS} tareas, en el orden en que se aplican. Cada tarea es un commit: pequeña, coherente y comprobable por sí sola. Prefiere pocas tareas.
- title: corto. description: instrucciones concretas para Develop, con rutas, nombres de columnas y los data-testid nuevos. Sigue las convenciones de AGENTS.md (estructura por entidad, dinero en céntimos, fechas YYYY-MM-DD, cacheComponents, data-testid existentes intactos).
- files: rutas exactas del repositorio que la tarea crea o modifica. Usa rutas del árbol que recibes o rutas nuevas que sigan su estructura.
- Un cambio de esquema solo toca src/db/schema.ts: la migración la genera la comprobación del PR. Nunca pidas ejecutar comandos ni escribir en drizzle/. Una columna nueva es nullable o lleva valor por defecto.
- references: de 1 a ${MAX_REFERENCES} archivos que ya existen en el árbol y sirven de modelo a Develop, que los lee enteros y copia su forma de trabajar. Elige el más parecido a lo que pide la tarea: para una página nueva, una página existente y sus actions o queries; para un campo nuevo, el formulario y la validación de la misma entidad. Puede coincidir con files cuando la tarea modifica ese archivo.
- Si una tarea crea una página nueva (un page.tsx que no está en el árbol), esa tarea incluye ${PAGES_FILE} en files y añade la página a la lista para que salga en las capturas.
- acceptanceCriteria: de 1 a 6 por tarea, con id único en todo el plan (c1, c2, c3…), siempre de tipo e2e: se comprueba en el DOM de la vista previa. Nombra la página, la acción si hace falta y el texto o el valor que debe aparecer. El tipo visual no se admite: lo visual lo revisa el cliente en las capturas. En lugar de «las vencidas se marcan en rojo», escribe «la etiqueta de estado de una factura vencida dice Vencida».
- testIds de cada criterio: de 1 a 6 data-testid en kebab-case, todos los que Testing necesita para comprobarlo, tanto para llegar (botones y campos que hay que pulsar o rellenar, como new-client-button, field-name o save-button) como para verificar. Los nuevos los nombras tú y van también en la description de la tarea, porque Develop debe usarlos tal cual. Los existentes, cópialos de AGENTS.md o del código que recibes. Los campos de formulario son field-<name> y los enlaces del menú nav-<ruta>: no inventes otros nombres para ellos. Para comprobar un filtro o una lista, incluye el data-testid de las filas o de su estado (invoice-row, status-badge). Si la tarea añade un <select>, su description fija el value de cada opción, para que Develop y Testing usen los mismos.
- Testing solo ve la vista previa desplegada, con datos que otros tests van añadiendo. Nunca escribas criterios sobre el código (columnas del esquema, funciones, consultas, tests unitarios) ni sobre cifras del seed: si el criterio necesita un dato, describe cómo se crea («al crear un cliente con notas, el detalle las muestra en client-notes»). Si una tarea solo cambia código interno, su criterio es el efecto que se ve en una página; por ejemplo, «la vista previa compila y /clientes carga la tabla clients-table».
- summary: qué verá el cliente cuando esté hecho, en dos o tres frases. assumptions: lo que has decidido sin que la petición lo diga.
- Todo el texto (summary, assumptions, títulos, descripciones, criterios y rejectionReason) en español.

${APP_MAP}

Responde solo con el JSON del esquema.`;

const fence = (path: string, content: string) =>
  `### ${path}\n\`\`\`\n${content.trimEnd()}\n\`\`\``;

export function orchestratorPrompt(input: PlanInput): string {
  const parts: string[] = [`## Petición del cliente\n${input.request}`];

  if (input.mode === "amend" && input.previous) {
    parts.push(
      [
        `## Replanificación tras la vista previa (revisión ${input.planRevision})`,
        "La rama ya tiene el código del plan anterior. Devuelve solo tareas nuevas o correctivas que se aplican encima; no repitas el trabajo ya hecho. Los ids de criterio empiezan de nuevo en c1.",
        `Resumen del plan anterior: ${input.previous.summary}`,
        ...input.previous.tasks.map((t) =>
          [
            `- Tarea ${t.position} · ${t.title} · estado: ${t.status}`,
            ...t.acceptanceCriteria.map(
              (c) =>
                `  - ${c.id} (${c.type}): ${c.text}${c.testIds?.length ? ` [${c.testIds.join(", ")}]` : ""}`,
            ),
            ...(t.lastFeedback
              ? [`  - Último feedback de Testing: ${t.lastFeedback}`]
              : []),
          ].join("\n"),
        ),
      ].join("\n"),
    );
  } else if (input.previous) {
    parts.push(
      [
        `## Replanificación del plan (revisión ${input.planRevision})`,
        "El cliente ha rechazado el plan anterior y aún no hay código. Devuelve un plan completo que lo sustituye.",
        `Resumen del plan anterior: ${input.previous.summary}`,
        ...input.previous.tasks.map(
          (t) => `- Tarea ${t.position} · ${t.title}`,
        ),
      ].join("\n"),
    );
  }
  if (input.feedback) {
    parts.push(`## Feedback del cliente\n${input.feedback}`);
  }

  const { context } = input;
  parts.push(
    [
      `## Repositorio crm-demo en ${context.baseSha.slice(0, 7)}`,
      `### Árbol de rutas (${context.tree.length} archivos)`,
      context.tree.join("\n"),
    ].join("\n"),
    ...context.files.map((f) => fence(f.path, f.content)),
  );
  return parts.join("\n\n");
}
