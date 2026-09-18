"use server"

import { revalidatePath } from "next/cache"
import { db, now as clockNow } from "@/lib/data/repo"
import { buildSystemPrompt } from "./prompt"
import { buildContextFor, mainAction } from "./respond"
import { runAgent, type TurnInput } from "./run"
import type { AgentActionKind } from "@/lib/domain/types"

/**
 * "Probalo": el chat de prueba de la pantalla del agente. Corre el MISMO
 * agente que atiende WhatsApp (mismo prompt, mismas herramientas), así que
 * si agenda, el turno aparece de verdad en la agenda — que es justamente lo
 * que hay que mostrarle al dueño.
 */
export async function testAgent(history: TurnInput[]): Promise<
  | { ok: true; reply: string; action: AgentActionKind | null; tokens: number; cached: number; model: string }
  | { ok: false; reason: string }
> {
  if (!history.length || history[history.length - 1].role !== "user") {
    return { ok: false, reason: "Escribí un mensaje primero." }
  }
  const s = await db()
  const now = await clockNow()
  const conv = { clientId: null, channel: "whatsapp" as const, participantName: "Cliente de prueba" }

  const result = await runAgent({
    settings: s.agentSettings,
    services: s.services,
    staff: s.staff,
    history,
    systemPrompt: buildSystemPrompt(s.agentSettings, s.services, s.staff),
    contextNote: await buildContextFor(conv, now),
    toolContext: { conversationId: null, clientId: null, participantName: conv.participantName, channel: "whatsapp", now },
  })
  if (!result.ok) return result

  const action = mainAction(result.actions.map((a) => a.action))
  if (action && action !== "consulta_respondida") revalidatePath("/", "layout")
  return {
    ok: true,
    reply: result.reply,
    action,
    tokens: result.usage.input + result.usage.output + result.usage.cacheRead + result.usage.cacheWrite,
    cached: result.usage.cacheRead,
    model: result.model,
  }
}
