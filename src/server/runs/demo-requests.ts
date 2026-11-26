/**
 * Suggested requests of the /runs home (D48). They fill the form without
 * sending it. H8 only needs to edit this list.
 */

export type DemoRequest = {
  /** Short label of the button. */
  label: string;
  /** What it exercises in the engine, for the evaluators. */
  covers: string;
  request: string;
};

export const DEMO_REQUESTS: readonly DemoRequest[] = [
  {
    label: "Tipo de cliente",
    covers: "Migración, dos tareas y un filtro",
    request:
      "Añade un tipo de cliente (Particular o Empresa) al formulario, muéstralo en la lista de clientes y permite filtrar la lista por tipo.",
  },
  {
    label: "Presupuestos del cliente",
    covers: "Una tarea sin migración",
    request: "Muestra en el detalle de un cliente cuántos presupuestos tiene.",
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
