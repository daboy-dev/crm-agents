export const RUN_STATUS: Record<string, string> = {
  queued: "En cola",
  planning: "Planificando",
  awaiting_plan_approval: "Esperando aprobación del plan",
  developing: "Desarrollando",
  awaiting_preview: "Esperando vista previa",
  testing: "Probando",
  awaiting_final_approval: "Esperando aprobación final",
  merging: "Fusionando",
  blocked: "Bloqueado",
  done: "Hecho",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  failed: "Fallido",
};

export const TASK_STATUS: Record<string, string> = {
  pending: "Pendiente",
  developing: "En desarrollo",
  testing: "En pruebas",
  passed: "Pasa",
  failed: "Falla",
  blocked: "Bloqueada",
};

export const ACTOR: Record<string, string> = {
  orchestrator: "Orquestador",
  develop: "Develop",
  testing: "Testing",
  human: "Cliente",
  system: "Sistema",
  github: "GitHub",
};

export const SCENARIO: Record<string, string> = {
  ok: "ok · todo pasa",
  "fail-once": "fail-once · la tarea 2 falla una vez",
  blocked: "blocked · la tarea 2 falla siempre",
  forbidden: "forbidden · Develop toca .github",
};

export function statusTone(status: string): string {
  switch (status) {
    case "done":
    case "passed":
      return "ok";
    case "blocked":
    case "failed":
    case "rejected":
      return "bad";
    case "awaiting_plan_approval":
    case "awaiting_final_approval":
      return "info";
    case "cancelled":
    case "queued":
    case "pending":
      return "neutral";
    default:
      return "work";
  }
}
