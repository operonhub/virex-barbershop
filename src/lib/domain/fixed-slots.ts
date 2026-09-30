import { at, hmToMinutes, minutesOfDay, weekday } from "@/lib/time"
import type { Appointment, FixedSlot } from "./types"

/**
 * Turnos fijos → bloqueos por fecha.
 *
 * `freeSlots` ya sabe de "bloqueos de un barbero en un rango" (los francos), así
 * que un turno fijo se traduce a eso: por cada día de la ventana en que cae, un
 * rango [inicio, fin) para ese barbero. Así el agente, la reserva web y el
 * panel dejan de ofrecer ese horario sin tocar la lógica de disponibilidad.
 *
 * Función pura: sin base ni reloj.
 */

export type FixedBlock = { staffId: string; startsAt: string; endsAt: string }

/** Cuántos días hacia adelante se bloquean. Más que lo que el agente ofrece (≈ 3 semanas). */
export const FIXED_HORIZON_DAYS = 120

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function expandFixedSlots(slots: FixedSlot[], fromDay: string, days = FIXED_HORIZON_DAYS): FixedBlock[] {
  const active = slots.filter((s) => s.active)
  if (!active.length) return []
  const blocks: FixedBlock[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDay, i)
    const wd = weekday(day)
    for (const s of active) {
      const hits = s.weekday !== null ? s.weekday === wd : s.onDate === day
      if (!hits) continue
      blocks.push({ staffId: s.staffId, startsAt: at(day, s.start).toISOString(), endsAt: at(day, s.end).toISOString() })
    }
  }
  return blocks
}

/**
 * Los turnos fijos activos que caen en ese día (semanales por día de la
 * semana, o de un día por fecha). Para MOSTRARLOS en la agenda: acá sí importa
 * quién y cuándo (`label`), no sólo el rango bloqueado.
 */
export function fixedSlotsOn(slots: FixedSlot[], day: string): FixedSlot[] {
  const wd = weekday(day)
  return slots
    .filter((s) => s.active && (s.weekday !== null ? s.weekday === wd : s.onDate === day))
    .sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * De los turnos fijos de un día, los que TODAVÍA no tienen un turno real
 * encima. Cuando el cliente fijo llega y se lo anota (Turno rápido, agenda),
 * el turno de verdad ocupa ese lugar: mostrar también el bloque fijo sería
 * verlo dos veces. `appointments` son los de ese mismo día.
 *
 * "Ocupado" es que el turno real cubra la MAYOR PARTE del fijo. Si sólo lo roza
 * (un corte de 16:35 a 17:35 contra un fijo de 17:15 a 18:00), el fijo se sigue
 * mostrando: ese choque es justo lo que el equipo tiene que ver.
 */
export function pendingFixedSlots(fixed: FixedSlot[], appointments: Appointment[]): FixedSlot[] {
  const live = appointments.filter((a) => a.status !== "cancelado" && a.status !== "no_show")
  return fixed.filter((f) => {
    const from = hmToMinutes(f.start)
    const to = hmToMinutes(f.end)
    const covered = live
      .filter((a) => a.staffId === f.staffId)
      .reduce((sum, a) => sum + Math.max(0, Math.min(to, minutesOfDay(a.endsAt)) - Math.max(from, minutesOfDay(a.startsAt))), 0)
    return covered * 2 < to - from
  })
}

/**
 * ¿Se pisan dos turnos fijos del mismo barbero? Con horarios a cualquier minuto
 * es fácil cargar "17:00 a 17:45" y "17:30 a 18:15" sin darse cuenta. Un semanal
 * y uno de un día se pisan si ese día cae en el mismo día de la semana.
 */
export function fixedSlotsClash(
  a: Pick<FixedSlot, "staffId" | "weekday" | "onDate" | "start" | "end">,
  b: Pick<FixedSlot, "staffId" | "weekday" | "onDate" | "start" | "end">
): boolean {
  if (a.staffId !== b.staffId) return false
  const sameDay =
    a.weekday !== null && b.weekday !== null
      ? a.weekday === b.weekday
      : a.weekday !== null
        ? weekday(b.onDate!) === a.weekday
        : b.weekday !== null
          ? weekday(a.onDate!) === b.weekday
          : a.onDate === b.onDate
  return sameDay && hmToMinutes(a.start) < hmToMinutes(b.end) && hmToMinutes(a.end) > hmToMinutes(b.start)
}
