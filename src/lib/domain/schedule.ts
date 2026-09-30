import { BRAND } from "@/config/brand"
import { hmToMinutes, minutesToHm } from "@/lib/time"
import type { WorkShift } from "./types"

/**
 * Horario semanal de un barbero: reglas puras, sin base ni pantalla.
 *
 * Un barbero puede tener VARIAS franjas el mismo día ("11 a 14 y 15 a 20": un
 * corte al mediodía) y cada una arranca y termina a cualquier múltiplo de 5
 * minutos. `freeSlots` ya sabe de varias franjas; esto es lo que faltaba para
 * poder cargarlas y validarlas.
 */

const HHMM = /^\d{2}:\d{2}$/

/** Todos los horarios de `from` a `to` (por defecto, el del local) cada `stepMin` minutos. */
export function timeOptions(stepMin = 5, from: string = BRAND.openingHours.open, to: string = BRAND.openingHours.close): string[] {
  const out: string[] = []
  for (let m = hmToMinutes(from); m <= hmToMinutes(to); m += stepMin) out.push(minutesToHm(m))
  return out
}

export type ShiftsResult = { ok: true; shifts: WorkShift[] } | { ok: false; error: string }

/**
 * Valida y ordena las franjas de un barbero. Cada una tiene que ser un día en
 * que abre el local, terminar después de empezar, caer dentro del horario del
 * local y no pisarse con otra del mismo día.
 */
export function normalizeShifts(shifts: WorkShift[]): ShiftsResult {
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
  clean.sort((x, y) => x.weekday - y.weekday || x.start.localeCompare(y.start))
  for (let i = 1; i < clean.length; i++) {
    const prev = clean[i - 1]
    const cur = clean[i]
    if (prev.weekday === cur.weekday && hmToMinutes(cur.start) < hmToMinutes(prev.end)) {
      return { ok: false, error: `Dos franjas del mismo día se pisan (${prev.start} a ${prev.end} y ${cur.start} a ${cur.end}).` }
    }
  }
  return { ok: true, shifts: clean }
}

/** El hueco entre dos franjas seguidas del mismo día (el corte del mediodía), si lo hay. */
export function breakBetween(a: { start: string; end: string }, b: { start: string; end: string }): { from: string; to: string } | null {
  return hmToMinutes(b.start) > hmToMinutes(a.end) ? { from: a.end, to: b.start } : null
}

/** Cuántas franjas como máximo en un día. */
export const MAX_RANGES = 3

/**
 * Al tocar "+ Agregar franja": si después de la última hay lugar, una nueva
 * desde una hora más tarde hasta el cierre (11 a 14 → suma 15 a 20). Si la
 * última ya llega hasta el cierre (11 a 20), se PARTE con un corte de una hora,
 * a las 14 si entra (11 a 14 y 15 a 20). Después se ajusta con los selectores.
 * Devuelve null si ya no entra otra franja.
 */
export function withAnotherRange(ranges: { start: string; end: string }[]): { start: string; end: string }[] | null {
  const close = hmToMinutes(BRAND.openingHours.close)
  const last = ranges.at(-1)
  if (!last || ranges.length >= MAX_RANGES) return null
  const from = hmToMinutes(last.start)
  const to = hmToMinutes(last.end)
  const afterStart = Math.min(to + 60, close - 30)
  if (afterStart > to) return [...ranges, { start: minutesToHm(afterStart), end: BRAND.openingHours.close }]
  const lunch = 14 * 60
  const cutFrom = from + 60 <= lunch && lunch + 120 <= to ? lunch : Math.floor((from + to) / 2 / 15) * 15 - 30
  const cutTo = cutFrom + 60
  if (cutFrom - from < 60 || to - cutTo < 60) return null
  return [...ranges.slice(0, -1), { start: last.start, end: minutesToHm(cutFrom) }, { start: minutesToHm(cutTo), end: last.end }]
}
