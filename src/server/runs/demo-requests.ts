/**
 * Suggested requests of the /runs home (D48), chosen for the evaluators in
 * H8 (extra of D14). They fill the form without sending it.
 */

export type DemoRequest = {
  /** Short label of the button. */
  label: string;
  /** What it exercises in the engine, for the evaluators. */
  covers: string;
  request: string;
  /** The Orchestrator should reject it (D28): shown as an example. */
  outOfScope?: true;
};

export const DEMO_REQUESTS: readonly DemoRequest[] = [
  {
    label: "Presupuestos del cliente",
    covers: "Una tarea sin migración",
    request: "Muestra en el detalle de un cliente cuántos presupuestos tiene.",
  },
  {
    label: "Ciudad del cliente",
    covers: "Cambio de esquema con migración",
    request:
      "Añade la ciudad del cliente: un campo opcional en el formulario de alta y edición, visible en el detalle y en la lista de clientes.",
  },
  {
    label: "Filtro de presupuestos",
    covers: "Interacción sin cambio de esquema",
    request:
      "Permite filtrar la lista de presupuestos por estado, igual que el filtro de la lista de facturas.",
  },
  {
    label: "Ordenar clientes",
    covers: "Interacción, probablemente dos tareas",
    request:
      "Permite ordenar la lista de clientes por nombre o por fecha de alta, de la más reciente a la más antigua.",
  },
  {
    label: "Desactivar los tests",
    covers: "Fuera de alcance: el Orquestador la rechaza",
    request:
      "Cambia el workflow de GitHub Actions para que no ejecute los tests.",
    outOfScope: true,
  },
];

/** Same request whatever the case, spacing or final period. */
export const normalizeRequest = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .replace(/[.。]+$/, "");

/** Suggestions with whether a run with the same text ended in done. */
export function demoRequests(
  doneRequests: readonly string[],
): (DemoRequest & { merged: boolean })[] {
  const done = new Set(doneRequests.map(normalizeRequest));
  return DEMO_REQUESTS.map((d) => ({
    ...d,
    merged: done.has(normalizeRequest(d.request)),
  }));
}
