"use server"

import { revalidatePath } from "next/cache"
import { assertPanelSession } from "@/lib/auth/guard"
import { db, newId, now } from "./repo"
import { at, dayKey } from "@/lib/time"
import { freeSlots } from "@/lib/domain/slots"
import { loyaltyDiscount, loyaltyStatus } from "@/lib/domain/loyalty"
import type {
  AgentSettings,
  AppointmentSource,
  AppointmentStatus,
  ConversationMode,
  ExpenseCategory,
  PaymentMethod,
} from "@/lib/domain/types"

/**
 * Mutaciones. En modo demo tocan el estado en memoria; con Supabase, cada
 * una pasa a ser un insert/update (y la creación de turnos queda protegida
 * por la restricción EXCLUDE de la base, no sólo por el chequeo de acá).
 *
 * Devuelven `{ ok, error }` en vez de lanzar: el error es un texto para
 * mostrar tal cual en un toast.
 */

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const refresh = () => revalidatePath("/", "layout")

type NewAppointment = {
  day: string
  time: string
  staffId: string
  serviceId: string
  clientId?: string
  newClient?: { name: string; phone?: string }
  source?: AppointmentSource
  notes?: string
}

/** Desde el panel: el equipo puede cargar a cualquier hora (cada 5 min) y sin anticipación mínima. */
export async function createAppointment(input: NewAppointment): Promise<Result<{ id: string }>> {
  await assertPanelSession()
  return book(input, { stepMin: 5, leadMin: 0 })
}

/**
 * Desde la reserva pública (/reservar): no hay sesión, así que acepta MENOS.
 * Siempre cliente nuevo con nombre y teléfono, origen "web", y sólo horarios
 * de la grilla del local con la anticipación normal.
 * TODO(producción): límite de pedidos por IP y verificación del teléfono.
 */
export async function createPublicBooking(input: {
  day: string
  time: string
  staffId: string
  serviceId: string
  name: string
  phone: string
}): Promise<Result<{ id: string }>> {
  const name = String(input.name ?? "").trim().slice(0, 80)
  const phone = String(input.phone ?? "").replace(/[^\d+]/g, "")
  if (name.length < 2) return { ok: false, error: "Poné tu nombre." }
  if (phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Revisá el teléfono: tiene que tener al menos 8 números." }
  return book(
    { day: input.day, time: input.time, staffId: input.staffId, serviceId: input.serviceId, newClient: { name, phone }, source: "web" },
    {}
  )
}

async function book(input: NewAppointment, grid: { stepMin?: number; leadMin?: number }): Promise<Result<{ id: string }>> {
  const s = await db()
  const service = s.services.find((x) => x.id === input.serviceId)
  const staff = s.staff.find((x) => x.id === input.staffId)
  if (!service || !staff) return { ok: false, error: "Elegí servicio y barbero." }

  const slots = freeSlots({
    day: input.day,
    service,
    staff,
    appointments: s.appointments,
    ...grid,
    now: await now(),
  })
  if (!slots.includes(input.time)) {
    return { ok: false, error: `${staff.name} no tiene libre ese horario. Elegí otro.` }
  }

  let clientId = input.clientId
  if (!clientId) {
    const name = input.newClient?.name.trim()
    if (!name) return { ok: false, error: "Falta el nombre del cliente." }
    clientId = newId("cl")
    s.clients.push({
      id: clientId,
      name,
      phone: input.newClient?.phone?.trim() || null,
      instagram: null,
      channel: "whatsapp",
      cutNotes: null,
      notes: null,
      preferredStaffId: staff.id,
      createdAt: new Date().toISOString(),
    })
  }

  const start = at(input.day, input.time)
  const id = newId("tu")
  s.appointments.push({
    id,
    clientId,
    staffId: staff.id,
    serviceId: service.id,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + service.durationMin * 60_000).toISOString(),
    status: "confirmado",
    source: input.source ?? "panel",
    price: service.price,
    notes: input.notes?.trim() || null,
    conversationId: null,
    createdAt: new Date().toISOString(),
  })
  refresh()
  return { ok: true, data: { id } }
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  const appt = s.appointments.find((a) => a.id === id)
  if (!appt) return { ok: false, error: "No encontré ese turno." }
  appt.status = status
  refresh()
  return { ok: true }
}

/**
 * Cobrar un turno. El descuento de fidelidad NO lo decide la pantalla: se
 * recalcula acá con la misma regla que dibuja la tarjeta, así no se puede
 * aplicar dos veces ni olvidarlo.
 */
export async function chargeAppointment(input: {
  appointmentId: string
  method: PaymentMethod
  tip: number
  useReward: boolean
}): Promise<Result<{ amount: number; discount: number }>> {
  const s = await db()
  const appt = s.appointments.find((a) => a.id === input.appointmentId)
  if (!appt) return { ok: false, error: "No encontré ese turno." }
  if (s.payments.some((p) => p.appointmentId === appt.id)) {
  await assertPanelSession()
    return { ok: false, error: "Ese turno ya está cobrado." }
  }
  const service = s.services.find((x) => x.id === appt.serviceId)!
  const status = loyaltyStatus(appt.clientId, s.payments, s.services)
  const discount = input.useReward ? loyaltyDiscount(status, service) : 0
  const tip = Math.max(0, Math.round(input.tip || 0))
  const amount = service.price - discount + tip
  const n = await now()

  s.payments.push({
    id: newId("co"),
    appointmentId: appt.id,
    clientId: appt.clientId,
    staffId: appt.staffId,
    serviceId: service.id,
    concept: service.name,
    kind: "servicio",
    listPrice: service.price,
    discount,
    discountReason: discount > 0 ? "fidelidad" : null,
    tip,
    amount,
    method: input.method,
    paidAt: n.toISOString(),
  })
  appt.status = "completado"
  refresh()
  return { ok: true, data: { amount, discount } }
}

export async function addExpense(input: {
  category: ExpenseCategory
  description: string
  amount: number
  method: PaymentMethod
}): Promise<Result> {
  await assertPanelSession()
  if (!input.description.trim() || !(input.amount > 0)) {
    return { ok: false, error: "Completá descripción y monto." }
  }
  const s = await db()
  s.expenses.push({
    id: newId("ga"),
    category: input.category,
    description: input.description.trim(),
    amount: Math.round(input.amount),
    method: input.method,
    paidAt: (await now()).toISOString(),
  })
  refresh()
  return { ok: true }
}

/* ── Bandeja ── */

/**
 * Mensaje escrito por una persona del equipo. Al escribir, la conversación
 * pasa a modo humano: si el agente siguiera contestando, se pisarían.
 *
 * Con Zernio conectado, acá va `sendMessage()` de `src/lib/zernio/client.ts`
 * con una Idempotency-Key, y el mensaje se guarda recién con el id que
 * devuelve Zernio.
 */
export async function sendStaffMessage(conversationId: string, body: string): Promise<Result> {
  await assertPanelSession()
  const text = body.trim()
  if (!text) return { ok: false, error: "El mensaje está vacío." }
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (!conv) return { ok: false, error: "No encontré la conversación." }
  const sentAt = (await now()).toISOString()
  s.messages.push({
    id: newId("ms"),
    conversationId,
    author: "staff",
    staffId: "st-santiago",
    body: text,
    sentAt,
    action: null,
    actionRef: null,
  })
  conv.mode = "humano"
  conv.needsHuman = false
  conv.unread = 0
  conv.lastMessageAt = sentAt
  refresh()
  return { ok: true }
}

export async function setConversationMode(conversationId: string, mode: ConversationMode): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (!conv) return { ok: false, error: "No encontré la conversación." }
  conv.mode = mode
  if (mode === "ia") {
    conv.needsHuman = false
    conv.handoffReason = null
  }
  refresh()
  return { ok: true }
}

export async function markConversationRead(conversationId: string): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (conv && conv.unread) {
    conv.unread = 0
    refresh()
  }
  return { ok: true }
}

/* ── Agente ── */

export async function updateAgentSettings(patch: Partial<AgentSettings>): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  s.agentSettings = { ...s.agentSettings, ...patch }
  refresh()
  return { ok: true }
}

/** Para el "¿cuándo hay lugar?" del diálogo de nuevo turno. */
export async function listFreeSlots(day: string, serviceId: string, staffId: string): Promise<string[]> {
  await assertPanelSession()
  const s = await db()
  const service = s.services.find((x) => x.id === serviceId)
  const staff = s.staff.find((x) => x.id === staffId)
  if (!service || !staff) return []
  const n = await now()
  return freeSlots({
    day,
    service,
    staff,
    appointments: s.appointments,
    now: n,
    leadMin: day === dayKey(n) ? 0 : 30,
    // El panel es para el equipo: puede meter un turno a cualquier cuarto de
    // hora (alguien que cae de pasada). La grilla en punto es para el agente y la web.
    stepMin: 15,
  })
}
