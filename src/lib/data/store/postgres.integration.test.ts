import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

/**
 * Prueba de integración contra la base REAL (la de DATABASE_URL). No corre
 * con `npm test`: se lanza a mano con `npm run test:integration`.
 *
 * Crea sus propios datos (todo con el prefijo "PRUEBA ·" y en una fecha
 * lejana) y los borra al terminar, aunque algo falle.
 */

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))
    return line?.slice("DATABASE_URL=".length).trim() || undefined
  } catch {
    return undefined
  }
}

const url = databaseUrl()
if (url) process.env.DATABASE_URL = url

const DAY = "2031-03-04" // un martes lejano: no choca con turnos reales
const TAG = "PRUEBA ·"

describe.skipIf(!url)("store de Postgres contra la base real", async () => {
  const { postgresStore: store, sqlClient } = await import("./postgres")
  const { SlotTakenError, AlreadyChargedError } = await import("./types")
  const sql = sqlClient()
  const created = { appointments: [] as string[], clients: [] as string[], conversations: [] as string[] }
  let staffId = ""
  let serviceId = ""

  const slot = (hour: number) => ({
    startsAt: new Date(`${DAY}T${String(hour).padStart(2, "0")}:00:00-03:00`).toISOString(),
    endsAt: new Date(`${DAY}T${String(hour + 1).padStart(2, "0")}:00:00-03:00`).toISOString(),
  })
  const appointment = (hour: number, clientId?: string) => ({
    clientId,
    staffId,
    serviceId,
    ...slot(hour),
    status: "confirmado" as const,
    source: "panel" as const,
    price: 15000,
    notes: `${TAG} test de integración`,
    conversationId: null,
  })

  beforeAll(async () => {
    const snap = await store.snapshot()
    staffId = snap.staff[0].id
    serviceId = snap.services[0].id
  })

  afterAll(async () => {
    const ids = created.appointments
    if (ids.length) {
      await sql`delete from payments where appointment_id in ${sql(ids)}`
      await sql`delete from appointments where id in ${sql(ids)}`
    }
    await sql`delete from appointments where notes like ${TAG + "%"}`
    if (created.conversations.length) await sql`delete from conversations where id in ${sql(created.conversations)}`
    await sql`delete from clients where name like ${TAG + "%"}`
    await sql.end()
  })

  it("lee el catálogo real", async () => {
    const snap = await store.snapshot()
    expect(snap.staff.map((s) => s.name)).toEqual(expect.arrayContaining(["Santiago", "Sebastián", "Nehemías"]))
    expect(snap.services.map((s) => s.price)).toEqual(expect.arrayContaining([15000, 20000]))
    expect(snap.simulated).toBe(false)
  })

  it("crea cliente y turno juntos", async () => {
    const r = await store.createAppointment({
      appointment: appointment(11),
      newClient: { name: `${TAG} Cliente`, phone: "+5491100000999", channel: "whatsapp", notes: null, preferredStaffId: null },
    })
    created.appointments.push(r.appointmentId)
    created.clients.push(r.clientId)
    const snap = await store.snapshot()
    expect(snap.appointments.find((a) => a.id === r.appointmentId)?.clientId).toBe(r.clientId)
  })

  it("dos reservas del mismo horario al mismo tiempo: la base deja pasar UNA", async () => {
    const clientId = created.clients[0]
    const results = await Promise.allSettled([
      store.createAppointment({ appointment: appointment(12, clientId) }),
      store.createAppointment({ appointment: appointment(12, clientId) }),
    ])
    const ok = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")
    ok.forEach((r) => created.appointments.push((r as PromiseFulfilledResult<{ appointmentId: string }>).value.appointmentId))
    expect(ok).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotTakenError)
  })

  it("reprogramar encima de otro turno falla con SlotTakenError", async () => {
    await expect(store.updateAppointment(created.appointments[0], slot(12))).rejects.toBeInstanceOf(SlotTakenError)
  })

  it("cobra una vez, deja el turno completado y rechaza el segundo cobro", async () => {
    const id = created.appointments[0]
    const payment = {
      appointmentId: id,
      clientId: created.clients[0],
      staffId,
      serviceId,
      concept: "Corte",
      kind: "servicio" as const,
      listPrice: 15000,
      discount: 0,
      discountReason: null,
      tip: 1000,
      amount: 16000,
      method: "efectivo" as const,
      paidAt: new Date().toISOString(),
    }
    await store.chargeAppointment(id, payment)
    const [a] = await sql`select status from appointments where id = ${id}`
    expect(a.status).toBe("completado")
    await expect(store.chargeAppointment(id, payment)).rejects.toBeInstanceOf(AlreadyChargedError)
  })

  it("un mensaje de WhatsApp repetido (reintento de Zernio) se guarda una sola vez", async () => {
    const conv = await store.upsertConversation({
      externalId: `prueba-${Date.now()}`,
      accountExternalId: "cuenta-prueba",
      channel: "whatsapp",
      participantName: `${TAG} Contacto`,
      participantHandle: "+5491100000999",
    })
    created.conversations.push(conv.id)
    // Encontró al cliente por el teléfono.
    expect(conv.clientId).toBe(created.clients[0])
    const msg = { externalId: `msg-${Date.now()}`, conversationId: conv.id, author: "cliente" as const, staffId: null, body: "hola", sentAt: new Date().toISOString(), action: null, actionRef: null }
    expect(await store.addMessage(msg)).not.toBeNull()
    expect(await store.addMessage(msg)).toBeNull()
  })
})
