/**
 * Query of /runs/[id]: the timeline filter (D44) and the mobile tab (D46)
 * live in the URL, so the polling keeps them and a link can be shared.
 */

import type { FilterId } from "@/server/runs/timeline";

export const TABS = [
  { id: "tareas", label: "Tareas" },
  { id: "linea", label: "Línea de tiempo" },
  { id: "vista-previa", label: "Vista previa" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** The preview opens first when it is the human's turn to approve it. */
export function parseTab(
  value: string | string[] | undefined,
  status: string,
): TabId {
  const v = Array.isArray(value) ? value[0] : value;
  if (TABS.some((t) => t.id === v)) return v as TabId;
  return status === "awaiting_final_approval" ? "vista-previa" : "tareas";
}

/** Link to the run page keeping the other parameter. */
export function runHref(
  runId: number,
  params: { agente: FilterId; tab: TabId; status: string },
): string {
  const query = new URLSearchParams();
  if (params.agente !== "todos") query.set("agente", params.agente);
  if (params.tab !== parseTab(undefined, params.status)) {
    query.set("tab", params.tab);
  }
  const q = query.toString();
  return q ? `/runs/${runId}?${q}` : `/runs/${runId}`;
}
