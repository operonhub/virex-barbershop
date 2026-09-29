import type { AgentActionKind } from "./types"

/** Frase del feed "Lo último que hizo" del agente: "Agendó un turno para Matías". */
export const ACTION_SUMMARY: Record<AgentActionKind, string> = {
  turno_creado: "Agendó un turno para",
  turno_reprogramado: "Reprogramó el turno de",
  turno_cancelado: "Canceló el turno de",
  consulta_respondida: "Respondió una consulta de",
  derivado_humano: "Derivó a una persona a",
  sello_consultado: "Le informó los sellos a",
}

export const summarizeAction = (kind: AgentActionKind, who: string) => `${ACTION_SUMMARY[kind]} ${who}`
