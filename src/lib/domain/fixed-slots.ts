import { at, weekday } from "@/lib/time"
import type { FixedSlot } from "./types"

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
