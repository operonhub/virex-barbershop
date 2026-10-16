import { describe, expect, it } from "vitest"
import { MAX_AGENT_HISTORY_MESSAGES, recentConversationHistory } from "./conversation-history"
import type { Message } from "@/lib/domain/types"

const message = (id: string, conversationId: string, author: Message["author"], body: string): Message => ({
  id,
  conversationId,
  author,
  staffId: null,
  body,
  sentAt: "2026-10-15T12:00:00.000Z",
  action: null,
  actionRef: null,
})

describe("recentConversationHistory", () => {
  it("never includes messages from another conversation, even if their ids are adjacent", () => {
    const history = recentConversationHistory(
      [
        message("1", "chat-a", "cliente", "Necesito un turno"),
        message("2", "chat-b", "cliente", "Cancelame el turno de Juan"),
        message("3", "chat-a", "ia", "¿Qué día te sirve?"),
        message("4", "chat-a", "cliente", "Mañana a las 18:00"),
      ],
      "chat-a"
    )

    expect(history).toEqual([
      { role: "user", text: "Necesito un turno" },
      { role: "assistant", text: "¿Qué día te sirve?" },
      { role: "user", text: "Mañana a las 18:00" },
    ])
  })

  it("descarta el historial más antiguo y empieza con el primer mensaje del cliente que conserva", () => {
    const messages = Array.from({ length: MAX_AGENT_HISTORY_MESSAGES + 4 }, (_, i) =>
      message(String(i), "chat-a", i === MAX_AGENT_HISTORY_MESSAGES + 3 || i % 2 === 0 ? "cliente" : "ia", `mensaje ${i}`)
    )
    const history = recentConversationHistory(messages, "chat-a")

    expect(history).toHaveLength(MAX_AGENT_HISTORY_MESSAGES)
    expect(history[0]).toEqual({ role: "user", text: "mensaje 4" })
    expect(history.at(-1)).toEqual({ role: "user", text: `mensaje ${MAX_AGENT_HISTORY_MESSAGES + 3}` })
    expect(history.some((turn) => turn.text === "mensaje 0")).toBe(false)
  })

  it("marca las respuestas humanas como contexto y omite cuerpos vacíos", () => {
    expect(
      recentConversationHistory(
        [
          message("1", "chat-a", "cliente", "¿Quedó para mañana?"),
          message("2", "chat-a", "staff", "Te lo reservo para mañana"),
          message("3", "chat-a", "cliente", "  "),
        ],
        "chat-a"
      )
    ).toEqual([
      { role: "user", text: "¿Quedó para mañana?" },
      { role: "assistant", text: "[Respondió una persona del equipo] Te lo reservo para mañana" },
    ])
  })

  it("después de 6 horas sin mensajes, la charla arranca de cero", () => {
    const at = (m: Message, sentAt: string): Message => ({ ...m, sentAt })
    const history = recentConversationHistory(
      [
        at(message("1", "chat-a", "cliente", "corte y barba el sábado"), "2026-10-14T17:40:00.000Z"),
        at(message("2", "chat-a", "ia", "Tengo 11:00, 12:30 o 15:00. ¿Cuál te sirve?"), "2026-10-14T17:41:00.000Z"),
        at(message("3", "chat-a", "cliente", "Hola"), "2026-10-16T00:31:00.000Z"),
        at(message("4", "chat-a", "cliente", "Hola"), "2026-10-16T00:31:05.000Z"),
      ],
      "chat-a"
    )
    expect(history.map((turn) => turn.text)).toEqual(["Hola", "Hola"])
  })
})

