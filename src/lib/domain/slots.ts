import { BRAND } from "@/config/brand"
import { at, hmToMinutes, minutesOfDay, minutesToHm, dayKey, weekday } from "@/lib/time"
import type { Appointment, Service, Staff } from "./types"

/**
 * Disponibilidad de turnos.
 *
 * Es la ÚNICA fuente de verdad sobre qué horarios se pueden ofrecer: la usan
 * el agente IA (herramienta `consultar_disponibilidad`), la página pública
 * de reservas y el diálogo de "Nuevo turno" del panel. Si cada uno calculara
 * lo suyo, tarde o temprano el agente ofrecería un horario que el panel ya
 * dio.
 *
 * Ojo: esto sólo *sugiere*. La garantía contra el doble turno está en la base
 * (restricción EXCLUDE sobre el rango horario por barbero, ver 0001_core.sql),
 * porque el agente y una persona pueden reservar el mismo hueco en el mismo
 * segundo.
 */

/** Estados que ocupan la silla. Un cancelado o un no-show liberan el hueco. */
const BLOCKING = new Set<Appointment["status"]>(["pendiente", "confirmado", "en_curso", "completado"])

export interface SlotQuery {
  day: string
  service: Pick<Service, "id" | "durationMin">
  staff: Pick<Staff, "id" | "skipsServiceIds" | "schedule" | "timeOff">
  appointments: Appointment[]
  /** Cada cuánto se ofrecen horarios. Por defecto, la grilla del local (turnos de una hora). */
  stepMin?: number
  /** Anticipación mínima para reservar hoy (no ofrecer "en 5 minutos"). */
  leadMin?: number
  now?: Date
}

/**
 * Franjas en que ese barbero atiende ese día, en minutos. Sin horario propio
 * (la demo) sigue el del local; con horario propio, sólo sus franjas, y
 * siempre dentro del horario del local.
 */
export function shiftsFor(staff: Pick<Staff, "schedule">, day: string): [number, number][] {
  const shopOpen = hmToMinutes(BRAND.openingHours.open)
  const shopClose = hmToMinutes(BRAND.openingHours.close)
  if (!staff.schedule) return [[shopOpen, shopClose]]
  const wd = weekday(day)
  return staff.schedule
    .filter((s) => s.weekday === wd)
    .map((s) => [Math.max(shopOpen, hmToMinutes(s.start)), Math.min(shopClose, hmToMinutes(s.end))] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
}

/**
 * Los tramos del horario del local en que ese barbero NO atiende ese día: el
 * corte del mediodía, antes de que entre, después de que sale, o todo el día si
 * no trabaja. Sirve para marcarlos en la agenda, así un hueco que es "no
 * atiende" no se confunde con uno libre.
 */
export function offHoursFor(staff: Pick<Staff, "schedule">, day: string): [number, number][] {
  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)
  const off: [number, number][] = []
  let cursor = open
  for (const [a, b] of shiftsFor(staff, day)) {
    if (a > cursor) off.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < close) off.push([cursor, close])
  return off
}

/**
 * ¿Ese barbero atiende ese día? No, si no tiene franjas ese día de la semana
 * o si un franco le cubre todas. Sirve para que el agente diga "no atiende
 * los jueves" en vez de "no queda lugar" (para el cliente no es lo mismo).
 */
export function worksOn(staff: Pick<Staff, "schedule" | "timeOff">, day: string): boolean {
  if (!isOpen(day)) return false
  const shifts = shiftsFor(staff, day)
  if (!shifts.length) return false
  const dayStart = at(day, "00:00").getTime()
  const off = (staff.timeOff ?? []).map((t) => [(new Date(t.startsAt).getTime() - dayStart) / 60_000, (new Date(t.endsAt).getTime() - dayStart) / 60_000])
  return shifts.some(([a, b]) => !off.some(([s, e]) => s <= a && e >= b))
}

export function isOpen(day: string): boolean {
  return (BRAND.openingHours.days as readonly number[]).includes(weekday(day))
}

export function freeSlots({
  day,
  service,
  staff,
  appointments,
  stepMin = BRAND.booking.slotStepMin,
  leadMin = 30,
  now = new Date(),
}: SlotQuery): string[] {
  if (!isOpen(day)) return []
  if (staff.skipsServiceIds.includes(service.id)) return []

  const busy = appointments
    .filter((a) => a.staffId === staff.id && BLOCKING.has(a.status) && dayKey(a.startsAt) === day)
    .map((a) => [minutesOfDay(a.startsAt), minutesOfDay(a.endsAt)] as const)

  // Francos y bloqueos que tocan este día, recortados a [0, 24h).
  const dayStart = at(day, "00:00").getTime()
  const off = (staff.timeOff ?? [])
    .map((t) => [(new Date(t.startsAt).getTime() - dayStart) / 60_000, (new Date(t.endsAt).getTime() - dayStart) / 60_000] as const)
    .filter(([s, e]) => e > 0 && s < 24 * 60)

  const earliest = day === dayKey(now) ? minutesOfDay(now) + leadMin : -Infinity

  const slots: string[] = []
  for (const [open, close] of shiftsFor(staff, day)) {
    // Candidatos: la grilla desde el inicio de la franja, MÁS el minuto en que
    // termina cada turno o bloqueo que ya hay. Sin lo segundo, un corte de 45'
    // que termina 17:45 deja muerto hasta las 18:00: el hueco de 15 minutos
    // nunca se ofrece y queda la agenda con agujeros.
    // El turno tiene que TERMINAR antes del fin de la franja, no sólo empezar.
    const starts = new Set<number>()
    for (let start = open; start + service.durationMin <= close; start += stepMin) starts.add(start)
    for (const [, e] of [...busy, ...off]) {
      const start = Math.round(e)
      if (start > open && start + service.durationMin <= close) starts.add(start)
    }
    for (const start of [...starts].sort((a, b) => a - b)) {
      if (start < earliest) continue
      const end = start + service.durationMin
      const collides = busy.some(([s, e]) => start < e && end > s) || off.some(([s, e]) => start < e && end > s)
      if (!collides) slots.push(minutesToHm(start))
    }
  }
  return slots
}

export interface ManualBookingQuery {
  day: string
  time: string
  durationMin: number
  service: Pick<Service, "id">
  staff: Pick<Staff, "id" | "name" | "skipsServiceIds" | "schedule" | "timeOff">
  appointments: Appointment[]
  now?: Date
  /** Hoy, cuántos minutos hacia atrás se tolera (alguien que ya llegó y se está atendiendo). */
  pastGraceMin?: number
}

export type ManualBookingCheck = { ok: true; warnings: string[] } | { ok: false; error: string }

const fmtRange = ([a, b]: [number, number]) => `${minutesToHm(a)} a ${minutesToHm(b)}`

/**
 * Validación de un turno cargado A MANO por el equipo (Nuevo turno, Turno
 * rápido). Distinta de `freeSlots`, que decide qué se OFRECE a un cliente o al
 * agente: el dueño manda en su local, así que acá sólo frena lo imposible
 * (local cerrado, fuera del horario del local, pisar a otro cliente) y AVISA,
 * sin trabar, lo discutible (fuera del horario del barbero, franco o turno
 * fijo). Puede ser a cualquier minuto y con cualquier duración.
 */
export function checkManualBooking(q: ManualBookingQuery): ManualBookingCheck {
  const { day, time, durationMin, staff, service, appointments, now = new Date(), pastGraceMin = 30 } = q
  if (!isOpen(day)) return { ok: false, error: "El local está cerrado ese día." }
  if (staff.skipsServiceIds.includes(service.id)) return { ok: false, error: `${staff.name} no hace este servicio.` }

  const shopOpen = hmToMinutes(BRAND.openingHours.open)
  const shopClose = hmToMinutes(BRAND.openingHours.close)
  const start = hmToMinutes(time)
  const end = start + durationMin
  if (!(durationMin > 0)) return { ok: false, error: "La duración tiene que ser mayor a cero." }
  if (start < shopOpen || end > shopClose) {
    return { ok: false, error: `Ese turno queda fuera del horario del local (${BRAND.openingHours.open} a ${BRAND.openingHours.close}).` }
  }
  const today = dayKey(now)
  if (day < today || (day === today && start < minutesOfDay(now) - pastGraceMin)) return { ok: false, error: "Ese horario ya pasó." }

  const clash = appointments
    .filter((a) => a.staffId === staff.id && BLOCKING.has(a.status) && dayKey(a.startsAt) === day)
    .find((a) => start < minutesOfDay(a.endsAt) && end > minutesOfDay(a.startsAt))
  if (clash) {
    return { ok: false, error: `${staff.name} ya tiene un turno de ${fmtRange([minutesOfDay(clash.startsAt), minutesOfDay(clash.endsAt)])}.` }
  }

  const warnings: string[] = []
  const shifts = shiftsFor(staff, day)
  if (!shifts.some(([a, b]) => start >= a && end <= b)) {
    warnings.push(
      shifts.length
        ? `${staff.name} no trabaja en ese horario (ese día atiende ${shifts.map(fmtRange).join(" y ")}).`
        : `${staff.name} no trabaja ese día.`
    )
  }
  const dayStart = at(day, "00:00").getTime()
  const inOff = (staff.timeOff ?? []).some((t) => {
    const s = (new Date(t.startsAt).getTime() - dayStart) / 60_000
    const e = (new Date(t.endsAt).getTime() - dayStart) / 60_000
    return start < e && end > s
  })
  if (inOff) warnings.push(`Coincide con un franco o un turno fijo de ${staff.name}.`)
  return { ok: true, warnings }
}

/** Para "con cualquiera": el primer barbero libre en cada horario. */
export function freeSlotsAnyStaff(
  query: Omit<SlotQuery, "staff"> & { staff: Pick<Staff, "id" | "skipsServiceIds" | "schedule" | "timeOff">[] }
): { time: string; staffId: string }[] {
  const byTime = new Map<string, string>()
  for (const member of query.staff) {
    for (const time of freeSlots({ ...query, staff: member })) {
      if (!byTime.has(time)) byTime.set(time, member.id)
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, staffId]) => ({ time, staffId }))
}

export function endOf(day: string, time: string, durationMin: number): Date {
  return new Date(at(day, time).getTime() + durationMin * 60_000)
}

/** Ocupación: minutos reservados / minutos disponibles de la silla. */
export function occupancy(appointments: Appointment[], staffCount: number, days: string[]): number {
  const openDays = days.filter(isOpen)
  const capacity =
    openDays.length *
    staffCount *
    (hmToMinutes(BRAND.openingHours.close) - hmToMinutes(BRAND.openingHours.open))
  if (capacity === 0) return 0
  const booked = appointments
    .filter((a) => BLOCKING.has(a.status) && openDays.includes(dayKey(a.startsAt)))
    .reduce((sum, a) => sum + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60000, 0)
  return Math.round((booked / capacity) * 100)
}
