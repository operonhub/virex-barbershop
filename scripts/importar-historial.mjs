// Carga el Excel de contabilidad de la barbería (antes del panel) en la base.
//
//   node scripts/importar-historial.mjs "ruta/al/excel.xlsx"                 → SIMULACRO: muestra qué haría, no escribe nada
//   node scripts/importar-historial.mjs "ruta/al/excel.xlsx" --apply         → carga de verdad
//   node scripts/importar-historial.mjs "ruta/al/excel.xlsx" --apply --replace
//        → si ya hay historial cargado, lo borra (sólo lo marcado como importado) y lo vuelve a cargar
//
// Las reglas de lectura (fechas por orden, fila de total llamada "PERFUMES",
// categorías de gastos) viven en src/lib/import/historial.ts, con tests.
// Necesita DATABASE_URL (de .env.local o del entorno). No imprime credenciales.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import postgres from "postgres"
import { parseGastos, parseVentas } from "../src/lib/import/historial.ts"

// `xlsx` es CommonJS: en un módulo ES hay que cargarlo así para tener `readFile`.
const XLSX = createRequire(import.meta.url)("xlsx")

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const APPLY = args.includes("--apply")
const REPLACE = args.includes("--replace")
const START_DAY = "2026-06-23" // primer martes del Excel ("MARTES 23/6")
if (!file) {
  console.error('Uso: node scripts/importar-historial.mjs "ruta/al/excel.xlsx" [--apply] [--replace]')
  process.exit(1)
}

// Quién es quién: las filas del Excel a los barberos del panel (por nombre).
const BARBERO_EN_PANEL = { VIREX: "sebasti", SANTI: "santiago", NEMO: "nehem" }

const wb = XLSX.readFile(file)
const filas = (nombre) => {
  if (!wb.Sheets[nombre]) throw new Error(`El Excel no tiene la hoja "${nombre}".`)
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null })
}

const lectura = parseVentas(filas("CANTIDAD"), START_DAY)
const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10) // hora argentina
const todosGastos = parseGastos(filas("GASTOS"))
const gastos = todosGastos.filter((g) => g.day <= hoy)
const futuros = todosGastos.length - gastos.length

const pesos = (n) => "$" + n.toLocaleString("es-AR")
const suma = (xs) => xs.reduce((s, x) => s + x, 0)
const porMes = (items, val) => {
  const m = {}
  for (const i of items) m[i.day.slice(0, 7)] = (m[i.day.slice(0, 7)] ?? 0) + val(i)
  return Object.entries(m).sort()
}

console.log(`\n== VENTAS ==  ${lectura.dias} días, ${lectura.ventas.length} movimientos, ${pesos(suma(lectura.ventas.map((v) => v.amount)))} en total`)
for (const [mes, total] of porMes(lectura.ventas, (v) => v.amount)) console.log(`  ${mes}  ${pesos(total)}`)
for (const b of ["VIREX", "SANTI", "NEMO"]) {
  const mine = lectura.ventas.filter((v) => v.barbero === b)
  console.log(`  ${b.padEnd(6)} ${suma(mine.map((v) => v.units))} cortes, ${pesos(suma(mine.map((v) => v.amount)))}`)
}
const by = (k) => pesos(suma(lectura.ventas.filter((v) => v.kind === k).map((v) => v.amount)))
console.log(`  seña ${by("sena")} · productos ${by("producto")}`)
const ef = pesos(suma(lectura.ventas.filter((v) => v.method === "efectivo").map((v) => v.amount)))
const tr = pesos(suma(lectura.ventas.filter((v) => v.method === "transferencia").map((v) => v.amount)))
console.log(`  efectivo ${ef} · transferencia ${tr}`)

console.log(`\n== GASTOS ==  ${gastos.length} gastos, ${pesos(suma(gastos.map((g) => g.amount)))} en total` + (futuros ? `  (${futuros} con fecha futura, no se cargan)` : ""))
for (const [mes, total] of porMes(gastos, (g) => g.amount)) console.log(`  ${mes}  ${pesos(total)}`)
const cat = {}
for (const g of gastos) cat[g.category] = (cat[g.category] ?? 0) + g.amount
console.log("  por categoría:", Object.entries(cat).map(([k, v]) => `${k} ${pesos(v)}`).join(" · "))

console.log(`\n== AVISOS (${lectura.avisos.length}) ==`)
for (const a of lectura.avisos) console.log("  · " + a)

if (!APPLY) {
  console.log("\nSimulacro: no se escribió nada. Para cargarlo: agregá --apply")
  process.exit(0)
}

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "")
if (!url) throw new Error("Falta DATABASE_URL.")
const sql = postgres(url, { max: 1 })

try {
  const staff = await sql`select id, name from staff`
  const idDe = {}
  for (const [excel, parte] of Object.entries(BARBERO_EN_PANEL)) {
    const m = staff.find((s) => s.name.toLowerCase().includes(parte))
    if (!m) throw new Error(`No encontré en el panel a quién corresponde "${excel}" (busqué un nombre que contenga "${parte}").`)
    idDe[excel] = m.id
  }
  console.log("\nCorrespondencia:", Object.entries(idDe).map(([e]) => `${e} → ${staff.find((s) => s.id === idDe[e]).name}`).join(" · "))

  const [{ n: yaP }] = await sql`select count(*)::int n from payments where imported`
  const [{ n: yaG }] = await sql`select count(*)::int n from expenses where imported`
  if ((yaP || yaG) && !REPLACE) {
    console.error(`\nYa hay historial cargado (${yaP} cobros, ${yaG} gastos). Para reemplazarlo: agregá --replace`)
    process.exit(1)
  }

  await sql.begin(async (tx) => {
    if (REPLACE) {
      await tx`delete from payments where imported`
      await tx`delete from expenses where imported`
    }
    const pagos = lectura.ventas.map((v) => ({
      staff_id: v.barbero ? idDe[v.barbero] : null,
      concept: v.concept,
      kind: v.kind,
      list_price: v.amount,
      amount: v.amount,
      method: v.method,
      paid_at: `${v.day}T20:00:00-03:00`,
      imported: true,
      units: v.units,
    }))
    for (let i = 0; i < pagos.length; i += 200) {
      await tx`insert into payments ${tx(pagos.slice(i, i + 200), "staff_id", "concept", "kind", "list_price", "amount", "method", "paid_at", "imported", "units")}`
    }
    const egresos = gastos.map((g) => ({
      category: g.category,
      description: g.description,
      amount: g.amount,
      method: "efectivo",
      paid_at: `${g.day}T12:00:00-03:00`,
      imported: true,
    }))
    for (let i = 0; i < egresos.length; i += 200) {
      await tx`insert into expenses ${tx(egresos.slice(i, i + 200), "category", "description", "amount", "method", "paid_at", "imported")}`
    }
  })
  const [{ n: p }] = await sql`select count(*)::int n from payments where imported`
  const [{ n: g }] = await sql`select count(*)::int n from expenses where imported`
  console.log(`\nListo: ${p} cobros y ${g} gastos importados.`)
} finally {
  await sql.end()
}
