// Corre la migración contra un Postgres real (PGlite) y prueba la regla más
// importante: la base rechaza dos turnos superpuestos del mismo barbero.
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist"
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto"

const db = new PGlite({ extensions: { btree_gist, pgcrypto } })
// Lo mínimo de Supabase que la migración referencia.
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create role anon; create role authenticated;
`)
for (const f of ["0001_core.sql", "0002_operacion.sql", "0003_endurecer.sql"]) {
  await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"))
  console.log(`✓ ${f} aplicada`)
}

const [{ id: staff }] = (await db.query(`insert into staff (name, role) values ('Leo','dueno') returning id`)).rows
const [{ id: svc }] = (await db.query(`insert into services (name, category, duration_min, price) values ('Corte','corte',40,14000) returning id`)).rows
const [{ id: cl }] = (await db.query(`insert into clients (name, phone) values ('Matías','+5491100000000') returning id`)).rows
const ins = (from, to, status = "confirmado") =>
  db.query(`insert into appointments (client_id, staff_id, service_id, starts_at, ends_at, source, price, status)
            values ($1,$2,$3,$4,$5,'agente',14000,$6)`, [cl, staff, svc, from, to, status])

await ins("2026-09-18T18:00:00-03", "2026-09-18T18:40:00-03")
console.log("✓ primer turno 18:00–18:40")
try {
  await ins("2026-09-18T18:20:00-03", "2026-09-18T19:00:00-03")
  console.log("✗ ERROR: aceptó un turno superpuesto"); process.exit(1)
} catch (e) { console.log("✓ rechazó el superpuesto:", e.message.split("\n")[0]) }
await ins("2026-09-18T18:40:00-03", "2026-09-18T19:20:00-03")
console.log("✓ aceptó el turno pegado (18:40), los rangos son [inicio, fin)")
await ins("2026-09-18T18:10:00-03", "2026-09-18T18:30:00-03", "cancelado")
console.log("✓ un cancelado no bloquea la silla")
try {
  await db.query(`insert into payments (concept, kind, list_price, discount, tip, amount, method) values ('Corte','servicio',14000,7000,0,9000,'efectivo')`)
  console.log("✗ ERROR: aceptó un total mal calculado"); process.exit(1)
} catch { console.log("✓ rechazó un cobro con total que no cierra") }

// 0002: seña + cobro final del mismo turno; nunca dos cobros de servicio.
const [{ id: turno }] = (await db.query(
  `insert into appointments (client_id, staff_id, service_id, starts_at, ends_at, source, price, status, hold_expires_at)
   values ($1,$2,$3,'2026-09-19T11:00:00-03','2026-09-19T12:00:00-03','web',15000,'pendiente', now() + interval '15 minutes') returning id`,
  [cl, staff, svc])).rows
const pay = (kind, amount, ref = null) =>
  db.query(`insert into payments (appointment_id, concept, kind, list_price, amount, method, external_ref)
            values ($1,'Corte',$2,$3,$3,'mercadopago',$4)`, [turno, kind, amount, ref])
await pay("sena", 5000, "mp-123")
console.log("✓ seña registrada")
try { await pay("sena", 5000, "mp-123"); console.log("✗ ERROR: aceptó la misma seña dos veces"); process.exit(1) }
catch { console.log("✓ rechazó el reintento del mismo pago de Mercado Pago") }
await pay("servicio", 10000)
console.log("✓ cobro final del mismo turno (seña + resto)")
try { await pay("servicio", 10000); console.log("✗ ERROR: cobró el turno dos veces"); process.exit(1) }
catch { console.log("✓ rechazó un segundo cobro del mismo turno") }
const settings = (await db.query(`select opening_cash, deposit_enabled from shop_settings`)).rows
console.log("✓ configuración del local creada:", JSON.stringify(settings[0]))
await db.close()
