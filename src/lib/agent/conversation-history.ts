import type { Message } from "@/lib/domain/types"
import type { TurnInput } from "./providers/types"

/** Sólo los 12 mensajes más recientes; los hilos de Zernio pueden durar meses. */
export const MAX_AGENT_HISTORY_MESSAGES = 12

/**
 * Si pasaron más de 6 horas sin mensajes, la charla arranca de cero: un "Hola" al día siguiente no
 * continúa la oferta de horarios de ayer (pasó: el agente repitió entera la oferta de la tarde anterior).
 * Los turnos que ya tiene el cliente igual le llegan por el contexto ("Turnos agendados").
 */
export const SESSION_GAP_MS = 6 * 60 * 60_000

/**
 * Construye el contexto conversacional desde un único chat interno.
 * Filtra por id antes de limitar: jamás se mezclan mensajes de otro chat, y
 * las conversaciones viejas no pueden reaparecer indefinidamente en el prompt.
 */
export function recentConversationHistory(messages: Message[], conversationId: string): TurnInput[] {
  const recent = messages
    .filter((message) => message.conversationId === conversationId && message.body.trim())
    .slice(-MAX_AGENT_HISTORY_MESSAGES)
  const lastGap = recent.findLastIndex(
    (message, i) => i > 0 && new Date(message.sentAt).getTime() - new Date(recent[i - 1].sentAt).getTime() > SESSION_GAP_MS
  )
  if (lastGap > 0) recent.splice(0, lastGap)
  const firstUser = recent.findIndex((message) => message.author === "cliente")

  return recent.slice(firstUser < 0 ? recent.length : firstUser).map((message) => ({
    role: message.author === "cliente" ? "user" : "assistant",
    text: message.author === "staff" ? `[Respondió una persona del equipo] ${message.body}` : message.body,
  }))
}
