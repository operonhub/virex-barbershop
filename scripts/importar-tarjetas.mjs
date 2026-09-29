// Carga las tarjetas de fidelidad de cartón (hoja "TARJETA DE FIDELIDAD" del Excel).
//
//   node scripts/importar-tarjetas.mjs "ruta/al/excel.xlsx"            → SIMULACRO: muestra qué haría, no escribe nada
//   node scripts/importar-tarjetas.mjs "ruta/al/excel.xlsx" --apply    → carga de verdad
//   node scripts/importar-tarjetas.mjs "ruta/al/excel.xlsx" --apply --replace
//        → si ya hay tarjetas cargadas, borra sólo esos sellos importados y los vuelve a cargar
//
// La fidelidad se DERIVA de los cobros (no hay contador): cada corte de la
// tarjeta se guarda como un cobro de $0 marcado `imported`, con el servicio
// "Corte" y a nombre del cliente. No suma plata (amount 0, units 0) y no toca
// el Excel de ventas que ya está cargado. Los clientes que ya existan (mismo
// teléfono o mismo nombre) se reutilizan; los demás se crean.
// Reglas de lectura en src/lib/import/historial.ts, con tests.
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import postgres from "postgres"
import { parseTarjetas } from "../src/lib/import/historial.ts"

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const APPLY = args.includes("--apply")
const REPLACE = args.includes("--replace")
if (!file) {
  console.error('Uso: node scripts/importar-tarjetas.mjs "ruta/al/excel.xlsx" [--apply] [--replace]')
  process.exit(1)
}
const CONCEPTO = "Historial · tarjeta de fidelidad"

const XLSX = createRequire(import.meta.url)("xlsx")
const wb = XLSX.readFile(file)
if (!wb.Sheets["TARJETA DE FIDELIDAD"]) throw new Error('El Excel no tiene la hoja "TARJETA DE FIDELIDAD".')
const { tarjetas, avisos } = parseTarjetas(XLSX.utils.sheet_to_json(wb.Sheets["TARJETA DE FIDELIDAD"], { header: 1, defval: null }))

const cortes = tarjetas.reduce((s, t) => s + t.cuts, 0)
console.log(`\n== TARJETAS ==  ${tarjetas.length} clientes, ${cortes} cortes en total`)
for (const t of tarjetas) console.log(`  ${t.name.padEnd(22)} ${t.cuts} corte${t.cuts === 1 ? " " : "s"}  ${t.phone ? "tel …" + t.phone.slice(-4) : "sin teléfono"}  ${t.days[0]}${t.days.length > 1 && t.days.at(-1) !== t.days[0] ? " a " + t.days.at(-1) : ""}`)
console.log(`\n== AVISOS (${avisos.length}) ==`)
for (const a of avisos) console.log("  · " + a)

if (!APPLY) {
  console.log("\nSimulacro: no se escribió nada. Para cargarlo: agregá --apply")
  process.exit(0)
}

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const url = process.env.DATABASE_URL || env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "")
if (!url) throw new Error("Falta DATABASE_URL.")
const sql = postgres(url, { max: 1 })

try {
  const [corte] = await sql`select id from services where lower(name) = 'corte' and counts_for_loyalty order by sort limit 1`
  if (!corte) throw new Error('No encontré el servicio "Corte" (que suma sello) en el panel.')

  const [{ n: ya }] = await sql`select count(*)::int n from payments where imported and concept = ${CONCEPTO}`
  if (ya && !REPLACE) {
    console.error(`\nYa hay ${ya} sellos de tarjetas cargados. Para reemplazarlos: agregá --replace`)
    process.exit(1)
  }

  const resumen = { creados: 0, reusados: 0, sellos: 0 }
  await sql.begin(async (tx) => {
    if (REPLACE) await tx`delete from payments where imported and concept = ${CONCEPTO}`
    for (const t of tarjetas) {
      const porTel = t.phone ? await tx`select id from clients where phone = ${t.phone}` : []
      const porNombre = porTel.length ? [] : await tx`select id from clients where lower(name) = ${t.name.toLowerCase()} limit 1`
      let clientId = (porTel[0] ?? porNombre[0])?.id
      if (clientId) resumen.reusados++
      else {
        const [c] = await tx`insert into clients (name, phone, channel, notes) values (${t.name}, ${t.phone}, 'whatsapp', 'Cargado de la tarjeta de fidelidad de cartón.') returning id`
        clientId = c.id
        resumen.creados++
      }
      const pagos = t.days.map((day) => ({
        client_id: clientId,
        service_id: corte.id,
        concept: CONCEPTO,
        kind: "servicio",
        list_price: 0,
        amount: 0,
        method: "efectivo",
        paid_at: `${day}T20:00:00-03:00`,
        imported: true,
        units: 0,
      }))
      await tx`insert into payments ${tx(pagos, "client_id", "service_id", "concept", "kind", "list_price", "amount", "method", "paid_at", "imported", "units")}`
      resumen.sellos += pagos.length
    }
  })
  console.log(`\nListo: ${resumen.creados} clientes creados, ${resumen.reusados} ya existían, ${resumen.sellos} sellos cargados.`)
} finally {
  await sql.end()
}
