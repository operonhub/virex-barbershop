"use server"

import { revalidatePath } from "next/cache"
import { assertPanelSession } from "@/lib/auth/guard"
import { db, now, store } from "./repo"
import { AlreadyChargedError, SlotTakenError } from "./store/types"
import { deliverToChannel } from "@/lib/zernio/deliver"
import { startDepositCheckout } from "@/lib/mercadopago/deposit"
import { at, dayKey } from "@/lib/time"
import { formatARS } from "@/lib/money"
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
 * Mutaciones del panel. Todas pasan por `store()` (memoria en la demo,
 * Supabase en producción) y la base tiene la última palabra: si dos personas
 * toman el mismo horario en el mismo segundo, la restricción EXCLUDE rechaza
 * a la segunda aunque el chequeo de acá haya dado libre.
 *
 * Devuelven `{ ok, error }` en vez de lanzar: el error es un texto para
 * mostrar tal cual en un toast.
 */

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const refresh = () => revalidatePath("/", "layout")
const validDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
const validTime = (t: unknown): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)

type NewAppointmentInput = {
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
export async function createAppointment(input: NewAppointmentInput): Promise<Result<{ id: string }>> {
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
}): Promise<Result<{ id: string; checkoutUrl?: string }>> {
  const name = String(input.name ?? "").trim().slice(0, 80)
  const phone = String(input.phone ?? "").replace(/[^\d+]/g, "")
  if (name.length < 2) return { ok: false, error: "Poné tu nombre." }
  if (phone.replace(/\D/g, "").length < 8) return { ok: false, error: "Revisá el teléfono: tiene que tener al menos 8 números." }
  return book(
    { day: input.day, time: input.time, staffId: input.staffId, serviceId: input.serviceId, newClient: { name, phone }, source: "web" },
    { requireDeposit: true }
  )
}

async function book(
  input: NewAppointmentInput,
  grid: { stepMin?: number; leadMin?: number; requireDeposit?: boolean }
): Promise<Result<{ id: string; checkoutUrl?: string }>> {
  if (!validDay(input.day) || !validTime(input.time)) return { ok: false, error: "Fecha u hora inválidas." }
  const s = await db()
  const service = s.services.find((x) => x.id === input.serviceId && x.active)
  const staff = s.staff.find((x) => x.id === input.staffId && x.active)
  if (!service || !staff) return { ok: false, error: "Elegí servicio y barbero." }

  const slots = freeSlots({ day: input.day, service, staff, appointments: s.appointments, ...grid, now: await now() })
  if (!slots.includes(input.time)) return { ok: false, error: `${staff.name} no tiene libre ese horario. Elegí otro.` }

  const name = input.newClient?.name.trim()
  if (!input.clientId && !name) return { ok: false, error: "Falta el nombre del cliente." }

  // La seña sólo aplica a la reserva pública (`requireDeposit`), y sólo si
  // Virex la tiene activada en Ajustes. Un turno cargado por el equipo o por
  // el agente por WhatsApp con `crear_turno` no pasa por acá.
  const useDeposit = !!grid.requireDeposit && s.shopSettings.depositEnabled
  const start = at(input.day, input.time)
  const holdExpiresAt = useDeposit ? new Date(Date.now() + s.shopSettings.depositHoldMin * 60_000).toISOString() : null
  try {
    const { appointmentId } = await store().createAppointment({
      appointment: {
        clientId: input.clientId,
        staffId: staff.id,
        serviceId: service.id,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + service.durationMin * 60_000).toISOString(),
        status: useDeposit ? "pendiente" : "confirmado",
        source: input.source ?? "panel",
        price: service.price,
        notes: input.notes?.trim() || null,
        conversationId: null,
        holdExpiresAt,
      },
      newClient: input.clientId
        ? undefined
        : { name: name!, phone: input.newClient?.phone?.trim() || null, channel: "whatsapp", notes: null, preferredStaffId: staff.id },
    })
    refresh()
    if (!useDeposit) return { ok: true, data: { id: appointmentId } }

    const checkoutUrl = await startDepositCheckout({
      appointmentId,
      serviceName: service.name,
      amount: s.shopSettings.depositAmount,
      holdMin: s.shopSettings.depositHoldMin,
    })
    if (!checkoutUrl) {
      // Sin el link de pago, la reserva no sirve de nada: se libera el horario en vez de dejarla colgada.
      await store().updateAppointment(appointmentId, { status: "cancelado", notes: "No se pudo generar el link de pago." })
      refresh()
      return { ok: false, error: "No se pudo generar el link de pago. Probá de nuevo en un minuto." }
    }
    return { ok: true, data: { id: appointmentId, checkoutUrl } }
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, error: `Alguien acaba de tomar ese horario con ${staff.name}. Elegí otro.` }
    throw e
  }
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  if (!s.appointments.some((a) => a.id === id)) return { ok: false, error: "No encontré ese turno." }
  try {
    await store().updateAppointment(id, { status })
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, error: "Ese horario ya lo ocupa otro turno: no se puede reactivar." }
    throw e
  }
  refresh()
  return { ok: true }
}

/**
 * Cobrar un turno. El descuento de fidelidad NO lo decide la pantalla: se
 * recalcula acá con la misma regla que dibuja la tarjeta, así no se puede
 * aplicar dos veces ni olvidarlo. Y la base impide cobrar el mismo turno dos
 * veces (aunque se toque "Cobrar" en dos celulares a la vez).
 */
export async function chargeAppointment(input: {
  appointmentId: string
  method: PaymentMethod
  tip: number
  useReward: boolean
}): Promise<Result<{ amount: number; discount: number }>> {
  await assertPanelSession()
  const s = await db()
  const appt = s.appointments.find((a) => a.id === input.appointmentId)
  if (!appt) return { ok: false, error: "No encontré ese turno." }
  if (s.payments.some((p) => p.appointmentId === appt.id && p.kind === "servicio")) {
    return { ok: false, error: "Ese turno ya está cobrado." }
  }
  const service = s.services.find((x) => x.id === appt.serviceId)
  if (!service) return { ok: false, error: "El servicio de ese turno ya no existe." }
  const status = loyaltyStatus(appt.clientId, s.payments, s.services)
  const discount = input.useReward ? loyaltyDiscount(status, service) : 0
  const tip = Math.max(0, Math.round(input.tip || 0))
  // Si ya pagó una seña por Mercado Pago, se descuenta de lo que se cobra
  // ahora en el local. El precio de lista queda reducido para que la cuenta
  // cierre (precio − descuento + propina = lo cobrado), pero la comisión del
  // barbero se calcula sobre el precio completo (ver `staffBreakdown`).
  const depositPaid = s.payments.find((p) => p.appointmentId === appt.id && p.kind === "sena")?.amount ?? 0
  const listPrice = Math.max(0, service.price - depositPaid)
  const amount = listPrice - discount + tip

  try {
    await store().chargeAppointment(appt.id, {
      appointmentId: appt.id,
      clientId: appt.clientId,
      staffId: appt.staffId,
      serviceId: service.id,
      concept: depositPaid > 0 ? `${service.name} (seña ${formatARS(depositPaid)} ya pagada)` : service.name,
      kind: "servicio",
      listPrice,
      discount,
      discountReason: discount > 0 ? "fidelidad" : null,
      tip,
      amount,
      method: input.method,
      paidAt: (await now()).toISOString(),
    })
  } catch (e) {
    if (e instanceof AlreadyChargedError) return { ok: false, error: "Ese turno ya está cobrado." }
    throw e
  }
  refresh()
  return { ok: true, data: { amount, discount } }
}

/**
 * Cobro rápido: alguien que cae sin turno (caminando). Crea el turno YA
 * completado (origen `walk_in`) y lo cobra en el mismo paso, así queda
 * registrado en la agenda, la caja, la comisión del barbero y la fidelidad —
 * lo mismo que si hubiera pasado por WhatsApp. Sin esto, un corte cobrado
 * "de una" no deja rastro en ningún lado.
 */
/**
 * Turno rápido: cae alguien de golpe y hay que anotarlo sin perder tiempo.
 * Nombre + servicio + barbero, y arranca YA (o apenas termine el turno que
 * ese barbero tiene en curso). Se cobra después desde Caja, como cualquier
 * otro turno: a diferencia de `quickCharge`, acá no se toca la plata.
 *
 * Es el equipo del local quien decide atender a alguien fuera de agenda, así
 * que no consulta francos ni turnos fijos: sólo evita pisar a otro cliente.
 */
export async function quickAppointment(input: {
  staffId: string
  serviceId: string
  clientId?: string
  name?: string
}): Promise<Result<{ startsAt: string; waitMin: number; staffName: string }>> {
  await assertPanelSession()
  const s = await db()
  const service = s.services.find((x) => x.id === input.serviceId && x.active)
  const staff = s.staff.find((x) => x.id === input.staffId && x.active)
  if (!service || !staff) return { ok: false, error: "Elegí el corte y quién lo hace." }

  const name = String(input.name ?? "").trim().slice(0, 60)
  if (input.clientId ? !s.clients.some((c) => c.id === input.clientId) : name.length < 2) {
    return { ok: false, error: "Poné el nombre del cliente." }
  }

  const n = await now()
  const ONE_MIN = 60_000
  // Si el barbero está con alguien, este turno arranca cuando termine (y así
  // encadenado, si ya tenía el siguiente pegado).
  const busy = s.appointments
    .filter((a) => a.staffId === staff.id && ["pendiente", "confirmado", "en_curso", "completado"].includes(a.status))
    .map((a) => [new Date(a.startsAt).getTime(), new Date(a.endsAt).getTime()] as const)
    .sort((a, b) => a[0] - b[0])
  let start = n.getTime()
  const duration = service.durationMin * ONE_MIN
  for (const [from, to] of busy) {
    if (start < to && start + duration > from) start = to
  }
  const waitMin = Math.max(0, Math.round((start - n.getTime()) / ONE_MIN))
  if (waitMin > 180) {
    return { ok: false, error: `${staff.name} está ocupado por un buen rato. Probá con otro barbero o agendalo a una hora.` }
  }

  try {
    await store().createAppointment({
      appointment: {
        clientId: input.clientId,
        staffId: staff.id,
        serviceId: service.id,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(start + duration).toISOString(),
        status: waitMin === 0 ? "en_curso" : "confirmado",
        source: "walk_in",
        price: service.price,
        notes: null,
        conversationId: null,
        holdExpiresAt: null,
      },
      newClient: input.clientId
        ? undefined
        : { name, phone: null, channel: "whatsapp", notes: null, preferredStaffId: staff.id },
    })
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, error: `${staff.name} justo tiene un turno en ese momento. Probá con otro barbero.` }
    throw e
  }
  refresh()
  return { ok: true, data: { startsAt: new Date(start).toISOString(), waitMin, staffName: staff.name } }
}

export async function quickCharge(input: {
  staffId: string
  serviceId: string
  clientId?: string
  newClient?: { name: string; phone?: string }
  method: PaymentMethod
  tip: number
  useReward: boolean
}): Promise<Result<{ amount: number; discount: number }>> {
  await assertPanelSession()
  const s = await db()
  const service = s.services.find((x) => x.id === input.serviceId && x.active)
  const staff = s.staff.find((x) => x.id === input.staffId && x.active)
  if (!service || !staff) return { ok: false, error: "Elegí servicio y barbero." }

  const name = input.newClient?.name.trim()
  if (!input.clientId && !name) return { ok: false, error: "Falta el nombre del cliente." }

  const n = await now()
  let appointmentId: string
  let clientId: string
  try {
    const created = await store().createAppointment({
      appointment: {
        clientId: input.clientId,
        staffId: staff.id,
        serviceId: service.id,
        startsAt: n.toISOString(),
        endsAt: new Date(n.getTime() + service.durationMin * 60_000).toISOString(),
        status: "completado",
        source: "walk_in",
        price: service.price,
        notes: null,
        conversationId: null,
        holdExpiresAt: null,
      },
      newClient: input.clientId
        ? undefined
        : { name: name!, phone: input.newClient?.phone?.trim() || null, channel: "whatsapp", notes: null, preferredStaffId: staff.id },
    })
    appointmentId = created.appointmentId
    clientId = created.clientId
  } catch (e) {
    if (e instanceof SlotTakenError) return { ok: false, error: `${staff.name} ya tiene un turno justo ahora. Esperá que termine o cobralo desde su turno.` }
    throw e
  }

  const status = loyaltyStatus(clientId, s.payments, s.services)
  const discount = input.useReward ? loyaltyDiscount(status, service) : 0
  const tip = Math.max(0, Math.round(input.tip || 0))
  const amount = service.price - discount + tip
  await store().chargeAppointment(appointmentId, {
    appointmentId,
    clientId,
    staffId: staff.id,
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
  await store().addExpense({
    category: input.category,
    description: input.description.trim().slice(0, 200),
    amount: Math.round(input.amount),
    method: input.method,
    paidAt: (await now()).toISOString(),
  })
  refresh()
  return { ok: true }
}

/**
 * Cierre de caja. La pantalla manda SÓLO lo contado: el efectivo esperado lo
 * recalcula el servidor (fondo + cobros en efectivo − gastos en efectivo del
 * día), así nadie lo ajusta para que "cierre justo". Uno por día: corregir
 * reemplaza el anterior.
 */
export async function closeCash(input: { day: string; counted: number; notes?: string }): Promise<Result<{ expected: number; difference: number }>> {
  await assertPanelSession()
  if (!validDay(input.day)) return { ok: false, error: "Día inválido." }
  const counted = Math.round(Number(input.counted))
  if (!Number.isFinite(counted) || counted < 0 || counted > 100_000_000) return { ok: false, error: "Revisá el monto contado." }
  const s = await db()
  const n = await now()
  if (input.day > dayKey(n)) return { ok: false, error: "No se puede cerrar un día que todavía no llegó." }
  const cashIn = s.payments.filter((p) => p.method === "efectivo" && dayKey(p.paidAt) === input.day).reduce((sum, p) => sum + p.amount, 0)
  const cashOut = s.expenses.filter((e) => e.method === "efectivo" && dayKey(e.paidAt) === input.day).reduce((sum, e) => sum + e.amount, 0)
  const openingCash = s.cashClosures.find((c) => c.day === input.day)?.openingCash ?? s.shopSettings.openingCash
  const expected = openingCash + cashIn - cashOut
  await store().closeCashDay({
    day: input.day,
    openingCash,
    expectedCash: expected,
    countedCash: counted,
    closedAt: n.toISOString(),
    notes: String(input.notes ?? "").trim().slice(0, 200) || null,
  })
  refresh()
  return { ok: true, data: { expected, difference: counted - expected } }
}

/* ── Bandeja ── */

/**
 * Mensaje escrito por una persona del equipo desde la Bandeja. Se manda de
 * verdad al WhatsApp/Instagram del cliente (por Zernio) y recién si salió se
 * guarda. La conversación pasa a modo humano: si el agente siguiera
 * contestando, se pisarían.
 */
export async function sendStaffMessage(conversationId: string, body: string): Promise<Result> {
  await assertPanelSession()
  const text = body.trim()
  if (!text) return { ok: false, error: "El mensaje está vacío." }
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (!conv) return { ok: false, error: "No encontré la conversación." }
  // Login simple con contraseña compartida: todavía no se sabe QUIÉN escribe.
  const owner = s.staff.find((x) => x.role === "dueno") ?? s.staff[0]
  const n = await now()
  const delivery = await deliverToChannel(conv, text, n)
  if (!delivery.ok) return { ok: false, error: delivery.error }
  const sentAt = n.toISOString()
  await store().addMessage({
    // Con el id de Zernio: si el eco del webhook llegó antes, no se duplica.
    externalId: delivery.externalId,
    conversationId,
    author: "staff",
    staffId: owner?.id ?? null,
    body: text,
    sentAt,
    action: null,
    actionRef: null,
  })
  await store().updateConversation(conversationId, { mode: "humano", needsHuman: false, unread: 0, lastMessageAt: sentAt })
  refresh()
  return { ok: true }
}

export async function setConversationMode(conversationId: string, mode: ConversationMode): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  if (!s.conversations.some((c) => c.id === conversationId)) return { ok: false, error: "No encontré la conversación." }
  await store().updateConversation(conversationId, mode === "ia" ? { mode, needsHuman: false, handoffReason: null } : { mode })
  refresh()
  return { ok: true }
}

export async function markConversationRead(conversationId: string): Promise<Result> {
  await assertPanelSession()
  const s = await db()
  const conv = s.conversations.find((c) => c.id === conversationId)
  if (conv && conv.unread) {
    await store().updateConversation(conversationId, { unread: 0 })
    refresh()
  }
  return { ok: true }
}

/* ── Agente ── */

export async function updateAgentSettings(patch: Partial<AgentSettings>): Promise<Result> {
  await assertPanelSession()
  await store().updateAgentSettings(patch)
  refresh()
  return { ok: true }
}

/** Para el "¿cuándo hay lugar?" del diálogo de nuevo turno. */
export async function listFreeSlots(day: string, serviceId: string, staffId: string): Promise<string[]> {
  await assertPanelSession()
  if (!validDay(day)) return []
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
