import "server-only"
import { connection } from "next/server"
import { memoryStore } from "./store/memory"
import { postgresStore } from "./store/postgres"
import type { Snapshot, Store } from "./store/types"
import { expandFixedSlots } from "@/lib/domain/fixed-slots"
import { dayKey } from "@/lib/time"

/**
 * Repositorio: elige la fuente de datos y es la única puerta a ellos.
 *
 *   DATABASE_URL presente  → la base real (Supabase).
 *   sin DATABASE_URL       → la demo en memoria, SÓLO en desarrollo o si se
 *                            pide explícitamente con DATA_SOURCE=demo (la
 *                            vidriera de ventas).
 *
 * En producción sin base y sin DATA_SOURCE=demo, la app se niega a arrancar:
 * un panel real mostrando datos inventados es peor que un error claro.
 */
export function store(): Store {
  if (process.env.DATABASE_URL) return postgresStore
  if (process.env.NODE_ENV !== "production" || process.env.DATA_SOURCE === "demo") return memoryStore
  throw new Error("Falta DATABASE_URL: el panel no tiene base de datos configurada.")
}

/** Todo lo que una pantalla necesita leer. */
export async function db(): Promise<Snapshot> {
  // Sin esto, Next prerenderiza las páginas en el build y quedan congeladas.
  await connection()
  const s = await store().snapshot()
  if (!s.fixedSlots.length) return s
  // Los turnos fijos se suman a los bloqueos de cada barbero: `freeSlots` ya
  // sabe de rangos ocupados, así el agente y la reserva web no los ofrecen.
  // Se copian los barberos: en la demo `s` es el estado vivo y no se muta.
  const blocks = expandFixedSlots(s.fixedSlots, dayKey(new Date(s.now)))
  return {
    ...s,
    staff: s.staff.map((m) => ({
      ...m,
      timeOff: [...(m.timeOff ?? []), ...blocks.filter((b) => b.staffId === m.id).map(({ startsAt, endsAt }) => ({ startsAt, endsAt }))],
    })),
  }
}

/** "Ahora" según la fuente (la demo puede simular una tarde de trabajo). No usar `new Date()` para cuentas del presente. */
export async function now(): Promise<Date> {
  return store().now()
}
