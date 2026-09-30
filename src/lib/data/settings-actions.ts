"use server"

import { revalidatePath } from "next/cache"
import { assertPanelSession } from "@/lib/auth/guard"
import { BRAND } from "@/config/brand"
import { at, dayKey, hmToMinutes, minutesOfDay } from "@/lib/time"
import { normalizeShifts } from "@/lib/domain/schedule"
import { fixedSlotsClash } from "@/lib/domain/fixed-slots"
import { db, now, store } from "./repo"
import type { ServiceCategory, WorkShift } from "@/lib/domain/types"

/**
 * Lo que se cambia desde Ajustes. Lo usan al mismo tiempo la agenda, la caja,
 * la reserva web y el agente: un precio nuevo lo cotiza el agente en el
 * mensaje siguiente, un franco saca a ese barbero de los horarios ofrecidos.
 */

type Result = { ok: true } | { ok: false; error: string }

const refresh = () => revalidatePath("/", "layout")
const HHMM = /^\d{2}:\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const CATEGORIES: ServiceCategory[] = ["corte", "barba", "combo", "color", "extra"]
const DURATIONS = [15, 30, 45, 60, 90, 120]

export async function saveService(input: {
  id?: string
  name: string
  category: ServiceCategory
  durationMin: number
  price: number
  countsForLoyalty: boolean
  active: boolean
}): Promise<Result> {
  await assertPanelSession()
  const name = String(input.name ?? "").trim().slice(0, 60)
  const price = Math.round(Number(input.price))
  if (name.length < 2) return { ok: false, error: "Poné un nombre para el servicio." }
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { ok: false, error: "Revisá el precio." }
  if (!DURATIONS.includes(input.durationMin)) return { ok: false, error: "Elegí una duración." }
  if (!CATEGORIES.includes(input.category)) return { ok: false, error: "Categoría inválida." }
  if (input.id && !(await db()).services.some((s) => s.id === input.id)) return { ok: false, error: "No encontré ese servicio." }
  await store().saveService({
    id: input.id,
    name,
    category: input.category,
    durationMin: input.durationMin,
    price,
    countsForLoyalty: !!input.countsForLoyalty,
    active: !!input.active,
  })
  refresh()
  return { ok: true }
}

export async function saveStaff(input: { id?: string; name: string; commissionPct: number; active: boolean }): Promise<Result> {
  await assertPanelSession()
  const name = String(input.name ?? "").trim().slice(0, 40)
  const commissionPct = Math.round(Number(input.commissionPct))
  if (name.length < 2) return { ok: false, error: "Poné el nombre." }
  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) return { ok: false, error: "La comisión va de 0 a 100 %." }
  const s = await db()
  const current = input.id ? s.staff.find((m) => m.id === input.id) : undefined
  if (input.id && !current) return { ok: false, error: "No encontré a esa persona." }
  if (current && !input.active && current.active) {
    const upcoming = s.appointments.filter(
      (a) => a.staffId === current.id && new Date(a.startsAt) > new Date() && (a.status === "pendiente" || a.status === "confirmado")
    ).length
    if (upcoming) return { ok: false, error: `${current.name} tiene ${upcoming} turno${upcoming === 1 ? "" : "s"} por delante. Movelos antes de darlo de baja.` }
  }
  await store().saveStaff({ id: input.id, name, role: current?.role ?? "barbero", commissionPct, active: !!input.active })
  refresh()
  return { ok: true }
}

/**
 * Reemplaza el horario semanal de un barbero. Puede tener varias franjas el
 * mismo día (un corte al mediodía: 11 a 14 y 15 a 20) y empezar o terminar a
 * cualquier múltiplo de 5 minutos. Las reglas (dentro del horario del local,
 * sin pisarse) están en `normalizeShifts`, con tests.
 */
export async function saveSchedule(staffId: string, shifts: WorkShift[]): Promise<Result> {
  await assertPanelSession()
  if (!(await db()).staff.some((m) => m.id === staffId)) return { ok: false, error: "No encontré a esa persona." }
  const checked = normalizeShifts(shifts)
  if (!checked.ok) return checked
  await store().setStaffSchedule(staffId, checked.shifts)
  refresh()
  return { ok: true }
}

/**
 * Franco, vacaciones o bloqueo. Día completo (desde–hasta inclusive) o un
 * rango de horas en un día. Avisa si hay turnos tomados en ese lapso: el
 * franco no los cancela solo (eso lo decide una persona).
 */
export async function addTimeOff(input: {
  staffId: string
  fromDay: string
  toDay: string
  fromTime?: string
  toTime?: string
  reason?: string
}): Promise<Result & { overlapping?: number }> {
  await assertPanelSession()
  const s = await db()
  const member = s.staff.find((m) => m.id === input.staffId)
  if (!member) return { ok: false, error: "Elegí a quién." }
  if (!DAY.test(input.fromDay) || !DAY.test(input.toDay)) return { ok: false, error: "Revisá las fechas." }
  const partial = !!(input.fromTime && input.toTime)
  if (partial && (!HHMM.test(input.fromTime!) || !HHMM.test(input.toTime!))) return { ok: false, error: "Revisá las horas." }
  const startsAt = at(input.fromDay, partial ? input.fromTime! : "00:00")
  // Día completo: hasta las 00:00 del día siguiente al último.
  const endsAt = partial ? at(input.toDay, input.toTime!) : new Date(at(input.toDay, "00:00").getTime() + 86_400_000)
  if (endsAt <= startsAt) return { ok: false, error: "El final tiene que ser después del comienzo." }
  if (endsAt.getTime() - startsAt.getTime() > 60 * 86_400_000) return { ok: false, error: "Como máximo 60 días seguidos." }

  await store().addTimeOff({
    staffId: member.id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reason: String(input.reason ?? "").trim().slice(0, 80) || null,
  })
  const overlapping = s.appointments.filter(
    (a) =>
      a.staffId === member.id &&
      (a.status === "pendiente" || a.status === "confirmado") &&
      new Date(a.startsAt) < endsAt &&
      new Date(a.endsAt) > startsAt
  ).length
  refresh()
  return { ok: true, overlapping }
}

export async function removeTimeOff(id: string): Promise<Result> {
  await assertPanelSession()
  if (!(await db()).timeOff.some((t) => t.id === id)) return { ok: false, error: "No encontré ese franco." }
  await store().removeTimeOff(id)
  refresh()
  return { ok: true }
}

/**
 * Turno fijo: un horario que queda reservado para alguien, todas las semanas
 * (`weekday`) o un día puntual (`onDate`). El agente y la reserva web dejan de
 * ofrecerlo. Avisa si ya hay turnos cargados en ese horario: no los cancela
 * (eso lo decide una persona).
 */
export async function saveFixedSlot(input: {
  id?: string
  staffId: string
  repeat: "weekly" | "once"
  weekday?: number
  onDate?: string
  start: string
  end: string
  label?: string
  active?: boolean
}): Promise<Result & { overlapping?: number }> {
  await assertPanelSession()
  const s = await db()
  const member = s.staff.find((m) => m.id === input.staffId)
  if (!member) return { ok: false, error: "Elegí quién atiende." }
  if (input.id && !s.fixedSlots.some((f) => f.id === input.id)) return { ok: false, error: "No encontré ese turno fijo." }
  if (!HHMM.test(input.start) || !HHMM.test(input.end)) return { ok: false, error: "Revisá las horas." }
  const a = hmToMinutes(input.start)
  const b = hmToMinutes(input.end)
  if (b <= a) return { ok: false, error: "La hora de fin tiene que ser después de la de inicio." }
  if (a < hmToMinutes(BRAND.openingHours.open) || b > hmToMinutes(BRAND.openingHours.close)) {
    return { ok: false, error: `El local abre de ${BRAND.openingHours.open} a ${BRAND.openingHours.close}.` }
  }

  let weekday: number | null = null
  let onDate: string | null = null
  if (input.repeat === "weekly") {
    weekday = Number(input.weekday)
    if (!(BRAND.openingHours.days as readonly number[]).includes(weekday)) return { ok: false, error: "Elegí un día en que el local abre." }
  } else {
    if (!DAY.test(String(input.onDate))) return { ok: false, error: "Elegí la fecha." }
    onDate = input.onDate!
    if (!(BRAND.openingHours.days as readonly number[]).includes(new Date(`${onDate}T12:00:00Z`).getUTCDay())) return { ok: false, error: "Ese día el local está cerrado." }
    if (onDate < dayKey(await now())) return { ok: false, error: "Esa fecha ya pasó." }
  }

  // Con horarios a cualquier minuto, es fácil cargar dos que se pisan sin darse cuenta.
  const clash = s.fixedSlots.find((f) => f.active && f.id !== input.id && fixedSlotsClash({ staffId: member.id, weekday, onDate, start: input.start, end: input.end }, f))
  if (clash) return { ok: false, error: `Se pisa con otro turno fijo de ${member.name} (${clash.start} a ${clash.end}).` }

  await store().saveFixedSlot({
    id: input.id,
    staffId: member.id,
    weekday,
    onDate,
    start: input.start,
    end: input.end,
    label: String(input.label ?? "").trim().slice(0, 60) || null,
    active: input.active ?? true,
  })

  // Turnos ya cargados que caen en ese horario (próximas 8 semanas, o el día puntual).
  const n = await now()
  const overlapping = s.appointments.filter((ap) => {
    if (ap.staffId !== member.id || !(ap.status === "pendiente" || ap.status === "confirmado")) return false
    if (new Date(ap.startsAt) < n || new Date(ap.startsAt).getTime() > n.getTime() + 56 * 86_400_000) return false
    const day = dayKey(ap.startsAt)
    if (weekday !== null ? new Date(`${day}T12:00:00Z`).getUTCDay() !== weekday : day !== onDate) return false
    return minutesOfDay(ap.startsAt) < b && minutesOfDay(ap.endsAt) > a
  }).length
  refresh()
  return { ok: true, overlapping }
}

export async function removeFixedSlot(id: string): Promise<Result> {
  await assertPanelSession()
  if (!(await db()).fixedSlots.some((f) => f.id === id)) return { ok: false, error: "No encontré ese turno fijo." }
  await store().removeFixedSlot(id)
  refresh()
  return { ok: true }
}

export async function saveShopSettings(input: { openingCash: number }): Promise<Result> {
  await assertPanelSession()
  const openingCash = Math.round(Number(input.openingCash))
  if (!Number.isFinite(openingCash) || openingCash < 0 || openingCash > 10_000_000) return { ok: false, error: "Revisá el monto." }
  await store().updateShopSettings({ openingCash })
  refresh()
  return { ok: true }
}

const SLOT_STEPS = [30, 45, 60]

/**
 * Cada cuántos minutos se ofrece un horario (30, 45 o 60). Lo usan el agente,
 * la reserva web y "Nuevo turno" a la vez. No toca los turnos ya cargados ni la
 * duración de cada servicio (esa se cambia en Servicios).
 */
export async function saveSlotStep(minutes: number): Promise<Result> {
  await assertPanelSession()
  if (!SLOT_STEPS.includes(minutes)) return { ok: false, error: "Elegí 30, 45 o 60 minutos." }
  await store().updateShopSettings({ slotStepMin: minutes })
  refresh()
  return { ok: true }
}

/**
 * Seña al reservar (Mercado Pago). Apagada por defecto: se prende cuando
 * Virex confirme que la cobra y por cuánto. Con `enabled: true` hace falta
 * `MERCADOPAGO_ACCESS_TOKEN` cargado — si no, avisa antes de prenderla, para
 * no dejar a un cliente reservando algo que después no puede pagar.
 */
export async function saveDepositSettings(input: { enabled: boolean; amount: number; holdMin: number }): Promise<Result> {
  await assertPanelSession()
  const amount = Math.round(Number(input.amount))
  const holdMin = Math.round(Number(input.holdMin))
  if (input.enabled) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, error: "Poné un monto de seña mayor a $0." }
    if (!Number.isFinite(holdMin) || holdMin < 5 || holdMin > 120) return { ok: false, error: "El tiempo para pagar va de 5 a 120 minutos." }
    const { readMercadoPagoConfig } = await import("@/lib/mercadopago/config")
    if (!readMercadoPagoConfig().configured) return { ok: false, error: "Falta cargar la clave de Mercado Pago en el servidor antes de activar la seña." }
  }
  await store().updateShopSettings({ depositEnabled: input.enabled, depositAmount: amount, depositHoldMin: holdMin || 15 })
  refresh()
  return { ok: true }
}
