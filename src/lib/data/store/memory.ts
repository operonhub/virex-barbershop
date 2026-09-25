import "server-only"
import { buildDemo, demoClock, SEED_VERSION, type DemoState } from "../seed"
import { dayKey } from "@/lib/time"
import { summarizeAction } from "@/lib/domain/agent-events"
import { AlreadyChargedError, SlotTakenError, type Store } from "./types"

/**
 * La demo en memoria: los datos los genera `seed.ts` y viven en `globalThis`
 * (sobreviven al hot-reload de `next dev`). Se regeneran solos cuando cambia
 * el día del reloj de la demo o `SEED_VERSION`.
 *
 * Imita las reglas de la base para que la demo se comporte igual que
 * producción: el choque de horarios y el doble cobro fallan con los mismos
 * errores que lanza Postgres.
 */

type Holder = { key: string; state: DemoState }
const g = globalThis as unknown as { __virexDemo?: Holder }

function state(): DemoState {
  const key = `${SEED_VERSION}:${dayKey(demoClock().now)}`
  if (!g.__virexDemo || g.__virexDemo.key !== key) g.__virexDemo = { key, state: buildDemo() }
  return g.__virexDemo.state
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const BLOCKING = new Set(["pendiente", "confirmado", "en_curso", "completado"])

/** Lo mismo que la restricción EXCLUDE de la base: mismo barbero, rangos [inicio, fin) que se pisan. */
function overlaps(s: DemoState, staffId: string, startsAt: string, endsAt: string, ignoreId?: string) {
  const a0 = new Date(startsAt).getTime()
  const a1 = new Date(endsAt).getTime()
  return s.appointments.some(
    (x) =>
      x.id !== ignoreId &&
      x.staffId === staffId &&
      BLOCKING.has(x.status) &&
      a0 < new Date(x.endsAt).getTime() &&
      a1 > new Date(x.startsAt).getTime()
  )
}

export const memoryStore: Store = {
  kind: "memory",

  async snapshot() {
    return state()
  },

  async now() {
    const s = state()
    return s.simulated ? new Date(s.now) : new Date()
  },

  async createAppointment({ appointment, newClient, linkConversationId }) {
    const s = state()
    if (overlaps(s, appointment.staffId, appointment.startsAt, appointment.endsAt)) throw new SlotTakenError()
    let clientId = appointment.clientId
    if (!clientId) {
      if (!newClient) throw new Error("Falta el cliente del turno.")
      clientId = newId("cl")
      s.clients.push({ id: clientId, instagram: null, cutNotes: null, createdAt: new Date().toISOString(), ...newClient })
      const conv = linkConversationId ? s.conversations.find((c) => c.id === linkConversationId) : undefined
      if (conv) conv.clientId = clientId
    }
    const id = newId("tu")
    s.appointments.push({ ...appointment, id, clientId, createdAt: appointment.createdAt ?? new Date().toISOString() })
    return { appointmentId: id, clientId }
  },

  async updateAppointment(id, patch) {
    const s = state()
    const appt = s.appointments.find((a) => a.id === id)
    if (!appt) return
    const next = { ...appt, ...patch }
    if ((patch.startsAt || patch.endsAt || patch.status) && BLOCKING.has(next.status) && overlaps(s, next.staffId, next.startsAt, next.endsAt, id)) {
      throw new SlotTakenError()
    }
    Object.assign(appt, patch)
  },

  async chargeAppointment(appointmentId, payment) {
    const s = state()
    if (s.payments.some((p) => p.appointmentId === appointmentId && p.kind === "servicio")) throw new AlreadyChargedError()
    s.payments.push({ ...payment, id: newId("co") })
    const appt = s.appointments.find((a) => a.id === appointmentId)
    if (appt) appt.status = "completado"
  },

  async addExpense(expense) {
    state().expenses.push({ ...expense, id: newId("ga") })
  },

  async updateAgentSettings(patch) {
    const s = state()
    s.agentSettings = { ...s.agentSettings, ...patch }
  },

  async upsertConversation(incoming) {
    const s = state()
    const found = s.conversations.find((c) => c.id === incoming.externalId)
    if (found) return found
    const digits = incoming.participantHandle?.replace(/\D/g, "") ?? ""
    const byPhone = digits ? s.clients.find((cl) => cl.phone?.replace(/\D/g, "").endsWith(digits.slice(-10))) : undefined
    const conv = {
      id: incoming.externalId,
      externalId: incoming.externalId,
      accountExternalId: incoming.accountExternalId,
      channel: incoming.channel,
      clientId: byPhone?.id ?? null,
      participantName: incoming.participantName,
      participantHandle: incoming.participantHandle,
      mode: "ia" as const,
      unread: 0,
      lastMessageAt: new Date().toISOString(),
      lastInboundAt: null,
      needsHuman: false,
      handoffReason: null,
    }
    s.conversations.unshift(conv)
    return conv
  },

  async updateConversation(id, patch) {
    const conv = state().conversations.find((c) => c.id === id)
    if (conv) Object.assign(conv, patch)
  },

  async addMessage({ externalId, ...message }) {
    const s = state()
    if (externalId && s.messages.some((m) => m.id === externalId)) return null
    const id = externalId ?? newId("ms")
    s.messages.push({ ...message, id })
    // En Postgres el feed del agente se deriva de los mensajes; acá se guarda aparte.
    if (message.author === "ia" && message.action) {
      const conv = s.conversations.find((c) => c.id === message.conversationId)
      if (conv) {
        s.agentEvents.unshift({
          id: newId("ev"),
          at: message.sentAt,
          kind: message.action,
          channel: conv.channel,
          conversationId: conv.id,
          summary: summarizeAction(message.action, conv.participantName),
        })
      }
    }
    return { id }
  },

  async recordAgentRun() {
    // La demo no audita corridas: el costo se ve en el playground de /agente.
  },

  async saveService({ id, ...data }) {
    const s = state()
    const found = id ? s.services.find((x) => x.id === id) : undefined
    if (found) {
      Object.assign(found, data)
      return found.id
    }
    const newIdValue = newId("sv")
    s.services.push({ id: newIdValue, ...data })
    return newIdValue
  },

  async saveStaff({ id, ...data }) {
    const s = state()
    const found = id ? s.staff.find((x) => x.id === id) : undefined
    if (found) {
      Object.assign(found, data)
      return found.id
    }
    const newIdValue = newId("st")
    s.staff.push({ id: newIdValue, skipsServiceIds: [], ...data })
    return newIdValue
  },

  async setStaffSchedule(staffId, shifts) {
    const m = state().staff.find((x) => x.id === staffId)
    if (m) m.schedule = shifts
  },

  async addTimeOff(entry) {
    const s = state()
    s.timeOff.push({ id: newId("fr"), ...entry })
    const m = s.staff.find((x) => x.id === entry.staffId)
    if (m) m.timeOff = [...(m.timeOff ?? []), { startsAt: entry.startsAt, endsAt: entry.endsAt }]
  },

  async removeTimeOff(id) {
    const s = state()
    const entry = s.timeOff.find((t) => t.id === id)
    if (!entry) return
    s.timeOff = s.timeOff.filter((t) => t.id !== id)
    const m = s.staff.find((x) => x.id === entry.staffId)
    if (m) m.timeOff = (m.timeOff ?? []).filter((t) => !(t.startsAt === entry.startsAt && t.endsAt === entry.endsAt))
  },

  async updateShopSettings(patch) {
    const s = state()
    s.shopSettings = { ...s.shopSettings, ...patch }
  },

  async closeCashDay(closure) {
    const s = state()
    s.cashClosures = [...s.cashClosures.filter((c) => c.day !== closure.day), closure]
  },
}
