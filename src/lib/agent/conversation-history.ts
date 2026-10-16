import { dayKey } from "@/lib/time"
import type { Message } from "@/lib/domain/types"
import type { TurnInput } from "./providers/types"

/** Sólo los 12 mensajes más recientes; los hilos de Zernio pueden durar meses. */
export const MAX_AGENT_HISTORY_MESSAGES = 12

/**
 * La charla arranca de cero cada día y después de 3 horas sin mensajes: un "Turno" al día siguiente no
 * continúa la oferta ni los errores de ayer (pasó: el agente pedía perdón por "el turno de hoy" de otra
 * charla). Los turnos que ya tiene el cliente igual le llegan por el contexto ("Turnos agendados").
 */
export const SESSION_GAP_MS = 3 * 60 * 60_000

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
  const today = recent.length ? dayKey(recent[recent.length - 1].sentAt) : null
  const firstToday = recent.findIndex((message) => dayKey(message.sentAt) === today)
  if (firstToday > 0) recent.splice(0, firstToday)
  const firstUser = recent.findIndex((message) => message.author === "cliente")

  return recent.slice(firstUser < 0 ? recent.length : firstUser).map((message) => ({
    role: message.author === "cliente" ? "user" : "assistant",
    text: message.author === "staff" ? `[Respondió una persona del equipo] ${message.body}` : message.body,
  }))
}
