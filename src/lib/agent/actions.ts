"use server"

import { revalidatePath } from "next/cache"
import { assertPanelSession } from "@/lib/auth/guard"
import { db, now as clockNow, store } from "@/lib/data/repo"
import { buildSystemPrompt } from "./prompt"
import { buildContextFor, mainAction } from "./respond"
import { runAgent, type TurnInput } from "./run"
import type { AgentActionKind } from "@/lib/domain/types"

/**
 * "Probalo": el chat de prueba de la pantalla del agente. Corre el MISMO
 * agente que atiende WhatsApp (mismo prompt, mismas herramientas, mismas
 * validaciones contra la agenda real).
 *
 * Con la base real corre en ENSAYO: no guarda turnos, cancelaciones ni
 * derivaciones. En la demo en memoria sí agenda, para mostrarle al dueño el
 * turno apareciendo en la agenda.
 */
export async function testAgent(history: TurnInput[]): Promise<
  | { ok: true; reply: string; action: AgentActionKind | null; tokens: number; model: string; costUsd: number | null; dryRun: boolean }
  | { ok: false; reason: string }
> {
  await assertPanelSession()
  if (!history.length || history[history.length - 1].role !== "user") {
    return { ok: false, reason: "Escribí un mensaje primero." }
  }
  const s = await db()
  const now = await clockNow()
  const conv = { clientId: null, channel: "whatsapp" as const, participantName: "Cliente de prueba" }
  const dryRun = store().kind === "postgres"

  const result = await runAgent({
    settings: s.agentSettings,
    services: s.services,
    staff: s.staff,
    history,
    systemPrompt: buildSystemPrompt(s.agentSettings, s.services, s.staff),
    contextNote: await buildContextFor(conv, now),
    toolContext: { conversationId: null, clientId: null, participantName: conv.participantName, channel: "whatsapp", now, dryRun },
  })
  if (!result.ok) return result

  const action = mainAction(result.actions.map((a) => a.action))
  if (!dryRun && action && action !== "consulta_respondida") revalidatePath("/", "layout")
  return {
    ok: true,
    reply: result.reply,
    action,
    tokens: result.usage.input + result.usage.output + result.usage.cacheRead + result.usage.cacheWrite,
    model: result.model,
    costUsd: result.costUsd,
    dryRun,
  }
}
