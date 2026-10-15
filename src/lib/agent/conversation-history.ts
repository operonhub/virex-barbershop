import type { Message } from "@/lib/domain/types"
import type { TurnInput } from "./providers/types"

/** Sólo los 12 mensajes más recientes; los hilos de Zernio pueden durar meses. */
export const MAX_AGENT_HISTORY_MESSAGES = 12

/**
 * Construye el contexto conversacional desde un único chat interno.
 * Filtra por id antes de limitar: jamás se mezclan mensajes de otro chat, y
 * las conversaciones viejas no pueden reaparecer indefinidamente en el prompt.
 */
export function recentConversationHistory(messages: Message[], conversationId: string): TurnInput[] {
  const recent = messages
    .filter((message) => message.conversationId === conversationId && message.body.trim())
    .slice(-MAX_AGENT_HISTORY_MESSAGES)
  const firstUser = recent.findIndex((message) => message.author === "cliente")

  return recent.slice(firstUser < 0 ? recent.length : firstUser).map((message) => ({
    role: message.author === "cliente" ? "user" : "assistant",
    text: message.author === "staff" ? `[Respondió una persona del equipo] ${message.body}` : message.body,
  }))
}
