import type { ExpenseCategory } from "../domain/types"

/**
 * Lectura del Excel de contabilidad de la barbería (antes del panel).
 *
 * Módulo **puro**: recibe las hojas ya leídas como filas y devuelve datos
 * limpios. No toca la base ni el disco (eso lo hace `scripts/importar-historial.mjs`),
 * así se prueba con Vitest. Todo lo raro que tiene el Excel está resuelto acá y
 * documentado, porque no se adivina:
 *
 *  - Hoja CANTIDAD: un bloque por día (martes a sábado). Adentro, una fila por
 *    barbero (VIREX, SANTI, NEMO) con cantidad, efectivo y transferencia, y filas
 *    de SEÑA, COLOR y PRODUCTOS DE BARBERÍA.
 *  - La fila "PERFUMES" NO son perfumes: en casi todos los días ahí quedó la
 *    fórmula del total. Y la fila "TOTAL" también es un total. Las dos se
 *    ignoran para sumar, y se usan para AVISAR si la cuenta no cierra.
 *  - Los encabezados de fecha tienen errores de tipeo (una semana dice "martes
 *    20/7" cuando el 20/7 fue lunes). El local abre de martes a sábado, así que
 *    las fechas se asignan por ORDEN a partir del primer día, y el encabezado
 *    sólo se usa para avisar cuando no coincide.
 *  - Hoja GASTOS: dos columnas de (fecha, monto, detalle) lado a lado, con fechas
 *    en formato de Excel (número de días desde 1899).
 */

type Row = unknown[]

export const BARBEROS_EXCEL = ["VIREX", "SANTI", "NEMO"] as const
export type BarberoExcel = (typeof BARBEROS_EXCEL)[number]

export type Metodo = "efectivo" | "transferencia"

export interface VentaHistorica {
  day: string // AAAA-MM-DD
  barbero: BarberoExcel | null
  kind: "servicio" | "producto" | "sena"
  concept: string
  method: Metodo
  amount: number
  /** Cortes que representa la fila (0 si el Excel no trae la cantidad). */
  units: number
}

export interface GastoHistorico {
  day: string
  amount: number
  description: string
  category: ExpenseCategory
}

export interface LecturaVentas {
  ventas: VentaHistorica[]
  /** Cosas que conviene revisar: días que no cierran, filas raras, encabezados corridos. */
  avisos: string[]
  dias: number
}

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v)
  return 0
}

const clean = (v: unknown) =>
  typeof v === "string"
    ? v
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
    : null

const DIA_HEADER = /^(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\s+(\d{1,2})\/(\d{1,2})/
const NOMBRES = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Excel guarda las fechas como días desde el 30/12/1899. */
export function excelDay(serial: number): string {
  return isoDay(new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000))
}

/** Los próximos `count` días de atención (martes a sábado) desde `start` inclusive. */
export function assignDays(count: number, start: string): string[] {
  const out: string[] = []
  let d = new Date(`${start}T12:00:00Z`)
  while (out.length < count) {
    const w = d.getUTCDay()
    if (w >= 2 && w <= 6) out.push(isoDay(d))
    d = new Date(d.getTime() + 86_400_000)
  }
  return out
}

type Bloque = { headerName: string; headerDay: number; headerMonth: number; lines: { label: string; n: number; cash: number; tr: number }[] }

export function parseVentas(rows: Row[], startDay: string): LecturaVentas {
  const bloques: Bloque[] = []
  let cur: Bloque | null = null
  for (const r of rows) {
    const label = clean(r[0])
    const header = label?.match(DIA_HEADER)
    if (header) {
      cur = { headerName: header[1], headerDay: Number(header[2]), headerMonth: Number(header[3]), lines: [] }
      bloques.push(cur)
      continue
    }
    // Un encabezado de tabla sin día ("CANTIDAD | EFECTIVO…") es un bloque futuro sin fecha: corta el actual.
    if (label === null && clean(r[1]) === "CANTIDAD") {
      cur = null
      continue
    }
    if (!cur || !label) continue
    cur.lines.push({ label, n: num(r[1]), cash: num(r[2]), tr: num(r[3]) })
  }

  const days = assignDays(bloques.length, startDay)
  const ventas: VentaHistorica[] = []
  const avisos: string[] = []

  bloques.forEach((b, i) => {
    const day = days[i]
    const real = NOMBRES[new Date(`${day}T12:00:00Z`).getUTCDay()]
    const [, mes, dia] = day.split("-").map(Number)
    if (b.headerName !== real || b.headerDay !== dia || b.headerMonth !== mes) {
      avisos.push(`${day}: el encabezado decía "${b.headerName.toLowerCase()} ${b.headerDay}/${b.headerMonth}" pero ese día es ${real.toLowerCase()} ${dia}/${mes} (usé la fecha por orden).`)
    }

    let sumado = 0
    const push = (barbero: BarberoExcel | null, kind: VentaHistorica["kind"], concept: string, n: number, cash: number, tr: number) => {
      // Los cortes se asignan a la primera fila con plata del barbero; la otra fila lleva 0.
      let units = n
      for (const [method, amount] of [["efectivo", cash], ["transferencia", tr]] as const) {
        if (amount <= 0) continue
        ventas.push({ day, barbero, kind, concept, method, amount, units })
        units = 0
        sumado += amount
      }
      if (n > 0 && cash <= 0 && tr <= 0) avisos.push(`${day}: ${barbero ? barbero.toLowerCase() : concept} tiene ${n} en cantidad pero ninguna plata anotada (esos cortes no se importaron).`)
      if (n === 0 && (cash > 0 || tr > 0) && kind === "servicio" && barbero) avisos.push(`${day}: ${barbero.toLowerCase()} tiene plata pero ninguna cantidad de cortes.`)
    }

    let totalHoja: number | null = null
    for (const l of b.lines) {
      if ((BARBEROS_EXCEL as readonly string[]).includes(l.label)) push(l.label as BarberoExcel, "servicio", "Historial · cortes", l.n, l.cash, l.tr)
      else if (l.label === "SENA") push(null, "sena", "Historial · seña", 0, l.cash, l.tr)
      else if (l.label === "COLOR") push(null, "servicio", "Historial · color", l.n, l.cash, l.tr)
      else if (l.label === "PRODUCTOS DE BARBERIA") push(null, "producto", "Historial · productos de barbería", l.n, l.cash, l.tr)
      else if (l.label === "PERFUMES" || l.label === "TOTAL") {
        // Es la fila del total del día (ver arriba); sólo sirve para controlar.
        const t = l.cash + l.tr
        if (t > 0) totalHoja = t
      } else if (l.cash > 0 || l.tr > 0) {
        // Plata que el total de la hoja sí cuenta: se importa igual (sin barbero) para que el mes cierre.
        push(null, "servicio", `Historial · ${l.label.toLowerCase()}`, l.n, l.cash, l.tr)
        avisos.push(`${day}: fila "${l.label.toLowerCase()}" que no es un barbero conocido: se cargó ${l.cash + l.tr} sin barbero asignado.`)
      }
    }
    if (totalHoja !== null && totalHoja !== sumado) avisos.push(`${day}: las filas suman ${sumado} pero el total de la hoja dice ${totalHoja}.`)
  })

  return { ventas, avisos, dias: bloques.length }
}

/* ── Tarjetas de fidelidad ── */

export interface TarjetaHistorica {
  name: string
  /** Teléfono de 10 dígitos (código de área + número), como se guardan en la base. */
  phone: string | null
  /** Cortes que llevaba en la tarjeta de cartón. */
  cuts: number
  /** Un día por corte (los que no tienen fecha propia usan la primera). */
  days: string[]
}

export interface LecturaTarjetas {
  tarjetas: TarjetaHistorica[]
  avisos: string[]
}

/** "SANTIAGO CAÑETE" → "Santiago Cañete". */
export function titleCase(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)(\p{L})/gu, (_, sp: string, ch: string) => sp + ch.toUpperCase())
}

/**
 * Teléfono argentino → 10 dígitos (área + número), que es como están en la base.
 * Acepta "11 2494 3921" y también el formato viejo con 15 ("15 6405 6665", que
 * en el AMBA es 11 + los últimos 8). Lo que no cierra devuelve null.
 */
export function normalizePhone(value: unknown): string | null {
  let d = String(value ?? "").replace(/\D/g, "")
  if (d.startsWith("549")) d = d.slice(3)
  else if (d.startsWith("54")) d = d.slice(2)
  if (d.length === 10 && d.startsWith("15")) d = "11" + d.slice(2)
  return d.length === 10 ? d : null
}

const YEAR = 2026

/** "6/3, 13/3" → ["2026-03-06", "2026-03-13"]; un número de Excel → su fecha. */
function parseFechas(value: unknown): string[] {
  if (typeof value === "number" && value > 40_000) return [excelDay(value)]
  if (typeof value !== "string") return []
  return [...value.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map((m) => `${YEAR}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`)
}

export function parseTarjetas(rows: Row[]): LecturaTarjetas {
  const tarjetas: TarjetaHistorica[] = []
  const avisos: string[] = []
  let lastRow = -2
  rows.forEach((r, i) => {
    const a = r[0]
    if (typeof a === "string" && a.trim() && clean(a) !== "CLIENTE") {
      const cuts = Math.round(num(r[1]))
      if (cuts < 1) {
        avisos.push(`${titleCase(a)}: sin cantidad de cortes, no se cargó.`)
        return
      }
      const fechas = parseFechas(r[2])
      if (!fechas.length) {
        avisos.push(`${titleCase(a)}: sin fecha de sus cortes, no se cargó.`)
        return
      }
      if (fechas.length > 1 && fechas.length !== cuts) avisos.push(`${titleCase(a)}: ${cuts} cortes pero ${fechas.length} fechas (los que faltan usan la primera).`)
      const days = Array.from({ length: cuts }, (_, k) => fechas[k] ?? fechas[0])
      tarjetas.push({ name: titleCase(a), phone: null, cuts, days })
      lastRow = i
      return
    }
    // El teléfono está en la fila de abajo del cliente, sin nombre.
    if ((typeof a === "number" || (typeof a === "string" && /^[\d\s+()-]+$/.test(a.trim()))) && lastRow === i - 1 && tarjetas.length) {
      const phone = normalizePhone(a)
      if (phone) tarjetas[tarjetas.length - 1].phone = phone
      else avisos.push(`${tarjetas[tarjetas.length - 1].name}: el teléfono "${String(a)}" no tiene 10 dígitos (no se cargó).`)
    }
  })
  return { tarjetas, avisos }
}

/* ── Gastos ── */

const RE = {
  sueldos: /\bvale\b|\bvasle\b|pago nemo|^nemo$|graciela/,
  alquiler: /alquiler/,
  servicios: /servicios|wifi|internet|\bagua\b|\bluz\b|\bgas\b|edesur|edenor|\babl\b/,
  marketing: /tarjetas|publicidad|cartel|flyer|folleto/,
  insumos: /navaja|filo|\bcera\b|cuello|tiza|vaso|talco|lisoform|limpieza|aluminio|\bpilas?\b|cafe|capsula|mascarilla|perfume|\bpala\b|genovesa|bebida|chicle|descartable/,
}

/** Categoría a partir del detalle que escribieron. Lo que no se reconoce va a "otros". */
export function categorizeExpense(detail: string | null): ExpenseCategory {
  const d = (clean(detail) ?? "").toLowerCase()
  if (RE.sueldos.test(d)) return "sueldos"
  if (RE.alquiler.test(d)) return "alquiler"
  if (RE.servicios.test(d)) return "servicios"
  if (RE.marketing.test(d)) return "marketing"
  if (RE.insumos.test(d)) return "insumos"
  return "otros"
}

/** (fecha, monto, detalle) lado a lado: columnas A-C y F-H. */
const COLUMNAS_GASTOS: [number, number, number][] = [
  [0, 1, 2],
  [5, 6, 7],
]

export function parseGastos(rows: Row[]): GastoHistorico[] {
  const out: GastoHistorico[] = []
  for (const r of rows) {
    for (const [d, m, t] of COLUMNAS_GASTOS) {
      const fecha = r[d]
      const monto = r[m]
      // Sin fecha es una fila de total semanal; sin monto, una fila vacía o el encabezado.
      if (typeof fecha !== "number" || fecha < 40_000 || typeof monto !== "number" || monto <= 0) continue
      const detalle = typeof r[t] === "string" ? (r[t] as string).trim() : ""
      out.push({
        day: excelDay(fecha),
        amount: Math.round(monto),
        description: detalle ? detalle.charAt(0).toUpperCase() + detalle.slice(1) : "Sin detalle",
        category: categorizeExpense(detalle),
      })
    }
  }
  return out
}
