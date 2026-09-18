/**
 * Hora argentina.
 *
 * Argentina no tiene horario de verano desde 2009: el offset es −03:00 fijo.
 * Por eso alcanza con construir fechas como `2026-09-17T11:00:00-03:00` en
 * vez de cargar una librería de zonas horarias. Si algún día vuelve el horario
 * de verano, este es el único archivo que hay que tocar.
 *
 * Convención: una "clave de día" (`dayKey`) es `YYYY-MM-DD` en hora argentina.
 */

export const TZ = "America/Argentina/Buenos_Aires"
const OFFSET = "-03:00"

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const hmFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

type DateLike = Date | string | number

const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d))

export function dayKey(d: DateLike = new Date()): string {
  return dayKeyFmt.format(toDate(d))
}

/** "14:30" en hora argentina. */
export function hm(d: DateLike): string {
  return hmFmt.format(toDate(d))
}

/** Minutos desde la medianoche argentina. */
export function minutesOfDay(d: DateLike): number {
  const [h, m] = hm(d).split(":").map(Number)
  return h * 60 + m
}

export function hmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

export function minutesToHm(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Instante exacto de un día + hora argentinos. */
export function at(day: string, time: string): Date {
  return new Date(`${day}T${time}:00${OFFSET}`)
}

export function addDays(day: string, n: number): string {
  const d = at(day, "12:00")
  d.setUTCDate(d.getUTCDate() + n)
  return dayKey(d)
}

/** 0 = domingo … 6 = sábado. */
export function weekday(day: string): number {
  return at(day, "12:00").getUTCDay()
}

export function monthKey(day: string): string {
  return day.slice(0, 7)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

const longFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
})
const shortFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
})
const monthFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  month: "long",
  year: "numeric",
})

/** "jueves 17 de septiembre" */
export function formatDayLong(day: string): string {
  return longFmt.format(at(day, "12:00"))
}

/** "jue 17 sept" */
export function formatDayShort(day: string): string {
  return shortFmt.format(at(day, "12:00")).replace(/\./g, "")
}

/** "septiembre de 2026" */
export function formatMonth(month: string): string {
  return monthFmt.format(at(`${month}-15`, "12:00"))
}

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

/** "hace 5 min", "hace 2 h", "ayer", "12/09". Pensado para listas de chats. */
export function timeAgo(d: DateLike, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - toDate(d).getTime()) / 60000)
  if (diffMin < 1) return "ahora"
  if (diffMin < 60) return `hace ${diffMin} min`
  const today = dayKey(now)
  const day = dayKey(d)
  if (day === today) return hm(d)
  if (day === addDays(today, -1)) return "ayer"
  const [, m, dd] = day.split("-")
  return `${dd}/${m}`
}
