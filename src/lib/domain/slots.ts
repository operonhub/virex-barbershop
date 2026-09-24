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
  staff: Pick<Staff, "id" | "skipsServiceIds">
  appointments: Appointment[]
  /** Cada cuánto se ofrecen horarios. Por defecto, la grilla del local (turnos de una hora). */
  stepMin?: number
  /** Anticipación mínima para reservar hoy (no ofrecer "en 5 minutos"). */
  leadMin?: number
  now?: Date
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

  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)

  const busy = appointments
    .filter((a) => a.staffId === staff.id && BLOCKING.has(a.status) && dayKey(a.startsAt) === day)
    .map((a) => [minutesOfDay(a.startsAt), minutesOfDay(a.endsAt)] as const)

  const earliest = day === dayKey(now) ? minutesOfDay(now) + leadMin : -Infinity

  const slots: string[] = []
  // El turno tiene que TERMINAR antes del cierre, no sólo empezar.
  for (let start = open; start + service.durationMin <= close; start += stepMin) {
    if (start < earliest) continue
    const end = start + service.durationMin
    const collides = busy.some(([s, e]) => start < e && end > s)
    if (!collides) slots.push(minutesToHm(start))
  }
  return slots
}

/** Para "con cualquiera": el primer barbero libre en cada horario. */
export function freeSlotsAnyStaff(
  query: Omit<SlotQuery, "staff"> & { staff: Pick<Staff, "id" | "skipsServiceIds">[] }
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
