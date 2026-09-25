"use server"

import { revalidatePath } from "next/cache"
import { assertPanelSession } from "@/lib/auth/guard"
import { BRAND } from "@/config/brand"
import { at, hmToMinutes } from "@/lib/time"
import { db, store } from "./repo"
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

/** Reemplaza el horario semanal de un barbero. Cada franja tiene que caer dentro del horario del local. */
export async function saveSchedule(staffId: string, shifts: WorkShift[]): Promise<Result> {
  await assertPanelSession()
  if (!(await db()).staff.some((m) => m.id === staffId)) return { ok: false, error: "No encontré a esa persona." }
  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)
  const clean: WorkShift[] = []
  for (const sh of shifts ?? []) {
    if (!Number.isInteger(sh.weekday) || sh.weekday < 0 || sh.weekday > 6) return { ok: false, error: "Día inválido." }
    if (!HHMM.test(sh.start) || !HHMM.test(sh.end)) return { ok: false, error: "Revisá las horas." }
    const a = hmToMinutes(sh.start)
    const b = hmToMinutes(sh.end)
    if (b <= a) return { ok: false, error: "La hora de salida tiene que ser después de la de entrada." }
    if (a < open || b > close) return { ok: false, error: `El local abre de ${BRAND.openingHours.open} a ${BRAND.openingHours.close}.` }
    clean.push({ weekday: sh.weekday, start: sh.start, end: sh.end })
  }
  await store().setStaffSchedule(staffId, clean)
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

export async function saveShopSettings(input: { openingCash: number }): Promise<Result> {
  await assertPanelSession()
  const openingCash = Math.round(Number(input.openingCash))
  if (!Number.isFinite(openingCash) || openingCash < 0 || openingCash > 10_000_000) return { ok: false, error: "Revisá el monto." }
  await store().updateShopSettings({ openingCash })
  refresh()
  return { ok: true }
}
