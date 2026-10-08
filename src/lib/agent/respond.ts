import "server-only"
import { db, now as clockNow, store } from "@/lib/data/repo"
import { loyaltyStatus } from "@/lib/domain/loyalty"
import { dayKey, formatDayLong, hm, minutesOfDay } from "@/lib/time"
import { deliverToChannel } from "@/lib/zernio/deliver"
import type { NormalizedEvent } from "@/lib/zernio/events"
import { buildContextNote, buildSystemPrompt } from "./prompt"
import { runAgent, type TurnInput } from "./run"
import { readAgentConfig } from "./config"
import { shouldHandOff } from "./handoff"
import type { AgentActionKind, Conversation } from "@/lib/domain/types"

/**
 * De la bandeja al agente y de vuelta.
 *
 *   webhook de Zernio ─▶ ingestInboxEvent ─▶ (after) respondToConversation
 *                                              │
 *                          ¿modo IA? ¿canal activo? ¿red de seguridad?
 *                                              │
 *                              runAgent (modelo + herramientas)
 *                                              │
 *                   guarda el mensaje ─▶ sendMessage (Zernio, Idempotency-Key)
 *
 * Lee con `db()` y escribe con `store()` (memoria en la demo, Supabase en
 * producción). Cada corrida del agente queda registrada en `agent_runs`.
 */

const ASK_TO_WRITE = "Hola, por acá no puedo escuchar audios ni ver fotos. ¿Me lo podés escribir, por favor?"

/** Guarda un evento del inbox. Devuelve la conversación si hay que responder. */
export async function ingestInboxEvent(event: Extract<NormalizedEvent, { kind: "inbox" }>): Promise<string | null> {
  const c = event.conversation
  const conv = await store().upsertConversation({
    externalId: c.externalId,
    accountExternalId: event.accountExternalId,
    channel: c.platform === "instagram" ? "instagram" : "whatsapp",
    participantName: c.participantName ?? c.participantHandle ?? "Contacto nuevo",
    participantHandle: c.participantHandle,
  })
  const m = event.message
  if (!m?.body) return null

  const inbound = m.direction === "inbound"
  const body = m.body

  if (!inbound) {
    // Un mensaje saliente puede ser el ECO de algo que mandó el panel (el
    // agente o alguien del equipo), o algo que el dueño escribió desde la app
    // en el celular (Coexistence). El eco se reconoce por texto: el panel lo
    // guarda ANTES de mandarlo, así que ya está.
    const s = await db()
    const since = new Date(m.sentAt).getTime() - 5 * 60_000
    const isEcho = s.messages.some(
      (x) => x.conversationId === conv.id && (x.author === "ia" || x.author === "staff") && x.body.trim() === body.trim() && new Date(x.sentAt).getTime() >= since
    )
    if (isEcho) return null
  }

  const saved = await store().addMessage({
    externalId: m.externalId,
    conversationId: conv.id,
    author: inbound ? "cliente" : "staff",
    staffId: null,
    body: m.body,
    sentAt: m.sentAt,
    action: null,
    actionRef: null,
  })
  if (!saved) return null // reintento de Zernio: ya estaba

  await store().updateConversation(
    conv.id,
    inbound
      ? { lastMessageAt: m.sentAt, lastInboundAt: m.sentAt, unread: conv.unread + 1 }
      : // Respondió una persona desde el celular: el agente se corre de esta conversación.
        { lastMessageAt: m.sentAt, mode: "humano", needsHuman: false }
  )
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
  // Si después del último mensaje del cliente ya contestó el agente (otra corrida se adelantó) o una
  // persona, no hay nada que responder: Gemini rechaza con 400 un pedido que termina en turno del modelo.
  if (thread[thread.length - 1] !== last) return { ok: true }
  const now = await clockNow()

  // Audio, foto o sticker llegan sin texto: la IA no tiene qué leer (y Gemini rechaza partes vacías con un 400).
  // Se le pide por favor que escriba; si insiste con otro mensaje sin texto, lo ve una persona.
  if (!last.body.trim()) {
    const alreadyAsked = thread.filter((m) => m.author === "ia").at(-1)?.body === ASK_TO_WRITE
    if (alreadyAsked) {
      const reason = "El cliente insiste con mensajes sin texto (audio, foto o sticker). Queda para una persona."
      await store().updateConversation(conv.id, { mode: "humano", needsHuman: true, handoffReason: reason })
      return { ok: true }
    }
    const sentAt = new Date().toISOString()
    const saved = await store().addMessage({ conversationId: conv.id, author: "ia", staffId: null, body: ASK_TO_WRITE, sentAt, action: null, actionRef: null })
    await store().updateConversation(conv.id, { lastMessageAt: sentAt, unread: 0 })
    const delivery = await deliverToChannel(conv, ASK_TO_WRITE, now)
    if (!delivery.ok) {
      await store().updateConversation(conv.id, { needsHuman: true, handoffReason: delivery.error })
      return { ok: false, reason: delivery.error }
    }
    if (saved && delivery.externalId) await store().setMessageExternalId(saved.id, delivery.externalId)
    return { ok: true }
  }

  const lastBooking = [...thread].reverse().findIndex((m) => m.action === "turno_creado")
  const guard = shouldHandOff({
    text: last.body,
    channel: conv.channel,
    agentRepliesWithoutBooking: (lastBooking === -1 ? thread : thread.slice(thread.length - lastBooking)).filter((m) => m.author === "ia").length,
    isKnownClient: !!conv.clientId,
    hour: Math.floor(minutesOfDay(now) / 60),
  })
  if (guard.handOff) {
    await store().updateConversation(conv.id, { mode: "humano", needsHuman: true, handoffReason: guard.reason })
    return { ok: true }
  }

  const history: TurnInput[] = thread.filter((m) => m.body.trim()).map((m) => ({
    role: m.author === "cliente" ? "user" : "assistant",
    text: m.author === "staff" ? `[Respondió una persona del equipo] ${m.body}` : m.body,
  }))

  const result = await runAgent({
    settings: s.agentSettings,
    services: s.services,
    staff: s.staff,
    history,
    systemPrompt: buildSystemPrompt(s.agentSettings, s.services, s.staff, s.shopSettings),
    contextNote: await buildContextFor(conv, now),
    toolContext: { conversationId: conv.id, clientId: conv.clientId, participantName: conv.participantName, channel: conv.channel, now },
  })

  await store()
    .recordAgentRun(
      result.ok
        ? { conversationId: conv.id, provider: result.provider, model: result.model, ok: true, failureReason: null, tools: result.actions, usage: result.usage, costUsd: result.costUsd }
        : { conversationId: conv.id, provider: readAgentConfig().provider, model: "", ok: false, failureReason: result.reason, tools: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, costUsd: null }
    )
    .catch((e) => console.warn("[agente] no se pudo registrar la corrida", (e as Error).message))

  if (!result.ok) {
    // Si la IA no puede, que lo vea una persona — nunca un cliente sin respuesta y sin nadie enterado.
    await store().updateConversation(conv.id, { mode: "humano", needsHuman: true, handoffReason: result.reason })
    return { ok: false, reason: result.reason }
  }

  const action = mainAction(result.actions.map((a) => a.action))
  const sentAt = new Date().toISOString()
  // Se guarda ANTES de mandar: así, si el eco del webhook llega rápido, ya
  // está en la base y se reconoce como propio.
  const saved = await store().addMessage({ conversationId: conv.id, author: "ia", staffId: null, body: result.reply, sentAt, action, actionRef: null })
  await store().updateConversation(conv.id, { lastMessageAt: sentAt, unread: 0, ...(result.clientId ? { clientId: result.clientId } : {}) })

  const delivery = await deliverToChannel(conv, result.reply, now)
  if (!delivery.ok) {
    await store().updateConversation(conv.id, { needsHuman: true, handoffReason: delivery.error })
    return { ok: false, reason: delivery.error }
  }
  if (saved && delivery.externalId) await store().setMessageExternalId(saved.id, delivery.externalId)
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
