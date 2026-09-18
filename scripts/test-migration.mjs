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
`)
await db.exec(readFileSync("supabase/migrations/0001_core.sql", "utf8"))
console.log("✓ migración aplicada")

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
await db.close()
