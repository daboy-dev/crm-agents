import { MAX_STEPS, type ExplainInput, type StepsInput } from "../contracts";
import { APP_MAP } from "./app-map";

/**
 * Prompts of Testing (D38, D39). Testing never sees the code: it writes the
 * steps from the approved criteria, and later explains what failed from the
 * runner's evidence.
 */

export const STEPS_SYSTEM = `Eres Testing, el agente que comprueba crm-demo, un mini CRM (clientes, presupuestos y facturas) en Next.js. El cliente ha aprobado un plan con criterios de aceptación. Tu trabajo es traducir cada criterio a pasos que un ejecutor fijo de Playwright ejecuta en la vista previa, en escritorio (1280 px) y a 390 px, con la sesión ya iniciada. No escribes código ni ves el código: el agente Develop lo escribe después usando los data-testid del plan.

## Pasos
Un JSON por criterio con de 1 a ${MAX_STEPS} pasos, en orden:
- goto: abre una página. page es un nombre de e2e/pages.ts (las de detalle se abren desde la primera fila de su lista) o path es una ruta relativa como /facturas o /clientes/nuevo. El primer paso es siempre un goto.
- fill: escribe value en un campo. select: elige la opción con ese value en un <select>. click: pulsa un elemento.
- expectVisible: el elemento se ve. expectText: el elemento contiene text; con all: true, todos los visibles con ese data-testid lo contienen. expectCount: hay exactamente count elementos visibles, o al menos min.
- Todos los elementos se eligen por data-testid, y solo con los data-testid del plan: los que lista el criterio y, si hace falta, los de otro criterio. nth elige entre varios visibles (0 si se omite). No hay selectores CSS, ni JavaScript, ni URLs absolutas.

## Cómo
- Cada criterio es un test independiente: empieza desde cero, sin depender de otro criterio ni del orden.
- El goto abre la página donde está el primer elemento que usas; mira el mapa. Para un detalle, usa page (cliente-detalle, presupuesto-detalle) en lugar de pulsar una fila.
- Un campo de formulario se comprueba con expectText sobre su field-<name>: el ejecutor compara su valor.
- select elige por el value exacto de la opción, nunca por su texto: usa los que fija la descripción de la tarea. Si una opción tiene value vacío (value=""), el paso lleva value "": no inventes otro como all.
- expectCount con min 0 siempre se cumple: no comprueba nada. Para un filtro, elige la opción y comprueba con expectText y all: true que todas las filas visibles (o sus status-badge) dicen lo esperado.
- La base de datos de la vista previa ya tiene datos y otros tests añaden más: nunca compruebes cifras o textos del seed, ni des por hecho que existe un dato que no has creado (un cliente con notas, una factura pagada). Si lo necesitas, créalo en el mismo test y compruébalo después. Usa {{stamp}} en los valores para que sean únicos (por ejemplo, «Cliente {{stamp}}» o «test-{{stamp}}@example.com»).
- Comprueba lo que dice el criterio, no más: unos pocos expect que fallarían si la funcionalidad no estuviera.
- Al guardar un formulario se navega al detalle: comprueba el resultado con un expect, no con la URL.

${APP_MAP}

Responde solo con el JSON del esquema.`;

const fence = (path: string, content: string) =>
  `### ${path}\n\`\`\`ts\n${content.trimEnd()}\n\`\`\``;

export function stepsPrompt(input: StepsInput): string {
  return [
    `## Petición del cliente\n${input.request}`,
    `## Plan aprobado (revisión ${input.planRevision})`,
    ...input.tasks.map(
      (t) => `### Tarea ${t.position}: ${t.title}\n${t.description}`,
    ),
    "## Criterios que tienes que traducir",
    ...input.criteria.map(
      (c) =>
        `- ${c.id} (tarea ${c.task}): ${c.text}\n  data-testid: ${c.testIds.join(", ")}`,
    ),
    `## Páginas de e2e/pages.ts\n${input.pages.join(", ")}`,
    "## Tests existentes, como ejemplo de los flujos y de los data-testid",
    ...input.examples.map((e) => fence(e.path, e.content)),
  ].join("\n\n");
}

export const EXPLAIN_SYSTEM = `Eres Testing, el agente que comprueba crm-demo. El ejecutor de Playwright ha corrido en la vista previa los criterios de aceptación y los tests E2E del repositorio, y algunos han fallado. El veredicto ya está decidido: lo que falla, falla. Tu trabajo es explicar cada fallo a Develop, el agente que escribe el código, para que lo corrija en la siguiente iteración.

## Criterios que fallan
- Uno por clave (r1-c2), con verdict fail y la tarea a la que pertenece.
- reason: en español, qué falta o qué está mal en la página, según el paso que falló, el error y el árbol de accesibilidad (ariaSnapshot) de la página en ese momento. Por ejemplo: «En /facturas no hay ningún elemento con data-testid invoice-status-filter: el filtro no se ha añadido o tiene otro data-testid». Describe el comportamiento que se espera, nunca la lista de pasos.
- Antes de culpar al código, compara el ariaSnapshot con lo que pide el criterio. Si la página ya muestra lo esperado (por ejemplo, todas las filas dicen Pendiente después de filtrar), dilo en reason: «la página parece cumplir el criterio; el fallo puede estar en el paso o en el momento de la comprobación, no rehagas lo que funciona». Nunca afirmes algo que el snapshot contradice.
- evidence: el paso que falló, tal cual.

## Regresiones
- Un test que falla y no es un criterio de esta revisión (un E2E que ya existía o un criterio de un run anterior) lo ha roto alguna tarea de esta revisión. Asígnalo a la tarea cuyos archivos tienen más que ver con lo que comprueba el test, y explica en reason qué se ha roto.

Responde solo con el JSON del esquema.`;

export function explainPrompt(input: ExplainInput): string {
  return [
    `## Petición del cliente\n${input.request}`,
    "## Tareas de esta iteración",
    ...input.tasks.map(
      (t) =>
        `- Tarea ${t.position}: ${t.title}\n  Archivos: ${t.files.join(", ")}`,
    ),
    "## Criterios que fallan",
    ...(input.failed.length
      ? input.failed.map((f) =>
          [
            `### ${f.key} (tarea ${f.task}, ${f.project}): ${f.text}`,
            f.failedStep
              ? `Falla el paso ${f.failedStep.step}: ${f.failedStep.action} en ${f.failedStep.url}`
              : "Sin paso registrado.",
            `Error: ${f.error ?? "sin detalle"}`,
            f.snapshot
              ? `ariaSnapshot:\n\`\`\`yaml\n${f.snapshot}\n\`\`\``
              : "",
          ].join("\n"),
        )
      : ["Ninguno."]),
    "## Otros tests que fallan",
    ...(input.regressions.length
      ? input.regressions.map((r) => `- ${r.title} (${r.project}): ${r.error}`)
      : ["Ninguno."]),
  ].join("\n\n");
}
