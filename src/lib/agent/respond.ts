import "server-only"
import { db, newId, now as clockNow } from "@/lib/data/repo"
import { loyaltyStatus } from "@/lib/domain/loyalty"
import { dayKey, formatDayLong, hm, minutesOfDay } from "@/lib/time"
import { readZernioConfig } from "@/lib/zernio/config"
import { sendMessage } from "@/lib/zernio/client"
import type { NormalizedEvent } from "@/lib/zernio/events"
import { buildContextNote, buildSystemPrompt } from "./prompt"
import { runAgent, type TurnInput } from "./run"
import { shouldHandOff } from "./handoff"
import type { AgentActionKind, Conversation } from "@/lib/domain/types"

/**
 * De la bandeja al agente y de vuelta.
 *
 *   webhook de Zernio ─▶ ingestInboxEvent ─▶ (after) respondToConversation
 *                                              │
 *                          ¿modo IA? ¿canal activo? ¿red de seguridad?
 *                                              │
 *                              runAgent (Claude + herramientas)
 *                                              │
 *                   guarda el mensaje ─▶ sendMessage (Zernio, Idempotency-Key)
 *
 * Demo: escribe en el estado en memoria. Con Supabase, `ingestInboxEvent` es
 * la función SECURITY DEFINER `ingest_social_event` (ver 0001_core.sql) y el
 * resto lee/escribe tablas.
 */

/** Guarda un evento del inbox. Devuelve la conversación si hay que responder. */
export async function ingestInboxEvent(event: Extract<NormalizedEvent, { kind: "inbox" }>): Promise<string | null> {
  const s = await db()
  const c = event.conversation
  let conv = s.conversations.find((x) => x.id === c.externalId)
  if (!conv) {
    const byPhone = s.clients.find((cl) => cl.phone && c.participantHandle && cl.phone.endsWith(c.participantHandle.replace(/\D/g, "")))
    conv = {
      id: c.externalId,
      channel: c.platform === "instagram" ? "instagram" : "whatsapp",
      clientId: byPhone?.id ?? null,
      participantName: c.participantName ?? c.participantHandle ?? "Contacto nuevo",
      participantHandle: c.participantHandle,
      mode: "ia",
      unread: 0,
      lastMessageAt: new Date().toISOString(),
      lastInboundAt: null,
      needsHuman: false,
      handoffReason: null,
    }
    s.conversations.unshift(conv)
  }
  const m = event.message
  if (!m?.body) return null
  if (m.externalId && s.messages.some((x) => x.id === m.externalId)) return null // reintento de Zernio

  const inbound = m.direction === "inbound"
  s.messages.push({
    id: m.externalId ?? newId("ms"),
    conversationId: conv.id,
    author: inbound ? "cliente" : "staff",
    staffId: null,
    body: m.body,
    sentAt: m.sentAt,
    action: null,
    actionRef: null,
  })
  conv.lastMessageAt = m.sentAt
  if (inbound) {
    conv.lastInboundAt = m.sentAt
    conv.unread += 1
  }
  return inbound ? conv.id : null
}

export async function respondToConversation(conversationId: string): Promise<{ ok: boolean; reason?: string }> {
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (!conv) return { ok: false, reason: "Conversación inexistente." }
  if (!s.agentSettings.enabled) return { ok: false, reason: "El agente está pausado." }
  if (!s.agentSettings.channels[conv.channel]) return { ok: false, reason: "El agente no atiende este canal." }
  if (conv.mode !== "ia") return { ok: false, reason: "La conversación la lleva una persona." }

  const thread = s.messages.filter((m) => m.conversationId === conv.id)
  const last = [...thread].reverse().find((m) => m.author === "cliente")
  if (!last) return { ok: false, reason: "No hay mensaje del cliente para responder." }
  const now = await clockNow()

  const lastBooking = [...thread].reverse().findIndex((m) => m.action === "turno_creado")
  const guard = shouldHandOff({
    text: last.body,
    channel: conv.channel,
    agentRepliesWithoutBooking: (lastBooking === -1 ? thread : thread.slice(thread.length - lastBooking)).filter((m) => m.author === "ia").length,
    isKnownClient: !!conv.clientId,
    hour: Math.floor(minutesOfDay(now) / 60),
  })
  if (guard.handOff) {
    conv.mode = "humano"
    conv.needsHuman = true
    conv.handoffReason = guard.reason
    return { ok: true }
  }

  const history: TurnInput[] = thread.map((m) => ({
    role: m.author === "cliente" ? "user" : "assistant",
    text: m.author === "staff" ? `[Respondió una persona del equipo] ${m.body}` : m.body,
  }))

  const result = await runAgent({
    settings: s.agentSettings,
    services: s.services,
    staff: s.staff,
    history,
    systemPrompt: buildSystemPrompt(s.agentSettings, s.services, s.staff),
    contextNote: await buildContextFor(conv, now),
    toolContext: { conversationId: conv.id, clientId: conv.clientId, participantName: conv.participantName, channel: conv.channel, now },
  })

  if (!result.ok) {
    // Si la IA no puede, que lo vea una persona — nunca un cliente sin respuesta y sin nadie enterado.
    conv.mode = "humano"
    conv.needsHuman = true
    conv.handoffReason = result.reason
    return { ok: false, reason: result.reason }
  }

  const action = mainAction(result.actions.map((a) => a.action))
  const sentAt = new Date().toISOString()
  const messageId = newId("ms")
  s.messages.push({ id: messageId, conversationId: conv.id, author: "ia", staffId: null, body: result.reply, sentAt, action, actionRef: null })
  conv.lastMessageAt = sentAt
  conv.unread = 0
  if (result.clientId) conv.clientId = result.clientId
  if (action) {
    s.agentEvents.unshift({ id: newId("ev"), at: sentAt, kind: action, channel: conv.channel, conversationId: conv.id, summary: `${ACTION_SUMMARY[action]} ${conv.participantName}` })
  }

  const zernio = readZernioConfig()
  if (zernio.configured) {
    const accountId = process.env.ZERNIO_ACCOUNT_ID ?? ""
    const sent = await sendMessage({ config: zernio }, { conversationId: conv.id, accountId, body: result.reply, idempotencyKey: messageId })
    if (!sent.ok) {
      conv.needsHuman = true
      conv.handoffReason = `No se pudo enviar por Zernio: ${sent.message}`
    }
  }
  return { ok: true }
}

const ACTION_PRIORITY: AgentActionKind[] = [
  "turno_creado",
  "turno_reprogramado",
  "turno_cancelado",
  "derivado_humano",
  "sello_consultado",
  "consulta_respondida",
]

/** La acción que se muestra en el hilo: la más importante de las que ejecutó. */
export function mainAction(actions: (AgentActionKind | undefined)[]): AgentActionKind | null {
  return ACTION_PRIORITY.find((a) => actions.includes(a)) ?? null
}

const ACTION_SUMMARY: Record<AgentActionKind, string> = {
  turno_creado: "Agendó un turno para",
  turno_reprogramado: "Reprogramó el turno de",
  turno_cancelado: "Canceló el turno de",
  consulta_respondida: "Respondió una consulta de",
  derivado_humano: "Derivó a una persona a",
  sello_consultado: "Le informó los sellos a",
}

/** Contexto volátil para el prompt: fecha/hora, canal y ficha del cliente. */
export async function buildContextFor(conv: Pick<Conversation, "clientId" | "channel" | "participantName">, now: Date): Promise<string> {
  const s = await db()
  const client = conv.clientId ? s.clients.find((c) => c.id === conv.clientId) : undefined
  const loyalty = client ? loyaltyStatus(client.id, s.payments, s.services) : null
  return buildContextNote({
    nowLabel: `${formatDayLong(dayKey(now))} ${dayKey(now).slice(0, 4)}, ${hm(now)} — fecha ISO ${dayKey(now)}`,
    channel: conv.channel,
    participantName: conv.participantName,
    client: client
      ? {
          name: client.name,
          phone: client.phone,
          visits: s.appointments.filter((a) => a.clientId === client.id && a.status === "completado").length,
          loyalty: loyalty!.rewardReady ? "tarjeta completa, el próximo corte va al 50%" : `${loyalty!.stamps} de ${loyalty!.required} sellos`,
          nextAppointments: s.appointments
            .filter((a) => a.clientId === client.id && new Date(a.startsAt) > now && ["pendiente", "confirmado"].includes(a.status))
            .map((a) => `${formatDayLong(dayKey(a.startsAt))} ${hm(a.startsAt)} (${s.services.find((x) => x.id === a.serviceId)?.name}, id ${a.id})`),
          cutNotes: client.cutNotes,
        }
      : null,
  })
}
