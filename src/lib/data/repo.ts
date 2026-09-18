import "server-only"
import { connection } from "next/server"
import { buildDemo, demoClock, SEED_VERSION, type DemoState } from "./seed"
import { dayKey } from "@/lib/time"

/**
 * Repositorio: la única puerta a los datos.
 *
 * Hoy lee y escribe un estado EN MEMORIA generado por `seed.ts` (modo demo).
 * Cuando se conecte Supabase, se reemplaza el cuerpo de estas funciones por
 * consultas — las pantallas y las server actions no se enteran, porque sólo
 * conocen estas firmas.
 *
 * El estado vive en `globalThis` para sobrevivir al hot-reload de `next dev`
 * (si no, cada guardado de archivo borraría lo que se cargó en la demo). Se
 * regenera solo cuando cambia el día del reloj de la demo.
 */

type Store = { key: string; state: DemoState }
const g = globalThis as unknown as { __virexDemo?: Store }

export async function db(): Promise<DemoState> {
  // Sin esto, Next prerenderiza las páginas en el build y el "ahora" de la
  // demo queda congelado en la hora del deploy.
  await connection()
  const key = `${SEED_VERSION}:${dayKey(demoClock().now)}`
  if (!g.__virexDemo || g.__virexDemo.key !== key) {
    g.__virexDemo = { key, state: buildDemo() }
  }
  return g.__virexDemo.state
}

/** "Ahora" según la demo. Toda cuenta relativa al presente usa esto, no `new Date()`. */
export async function now(): Promise<Date> {
  const state = await db()
  return state.simulated ? new Date(state.now) : new Date()
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
