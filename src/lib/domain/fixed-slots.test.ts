import { describe, expect, it } from "vitest"
import { expandFixedSlots, fixedSlotsClash, fixedSlotsOn, pendingFixedSlots } from "./fixed-slots"
import { freeSlots } from "./slots"
import { at } from "@/lib/time"
import type { Appointment, FixedSlot } from "./types"

const slot = (over: Partial<FixedSlot>): FixedSlot => ({
  id: "f1",
  staffId: "seba",
  weekday: 2, // martes
  onDate: null,
  start: "18:00",
  end: "19:00",
  label: "Juan",
  active: true,
  ...over,
})

describe("turnos fijos en la agenda de un día", () => {
  it("trae los semanales de ese día de la semana y los de esa fecha, ordenados por hora", () => {
    const slots = [
      slot({ id: "a", start: "19:00", end: "20:00" }), // martes
      slot({ id: "b", start: "12:00", end: "13:00" }), // martes
      slot({ id: "c", weekday: 3 }), // miércoles
      slot({ id: "d", weekday: null, onDate: "2026-09-29", start: "15:00", end: "16:00" }), // ese martes puntual
      slot({ id: "e", weekday: null, onDate: "2026-10-06" }), // otro martes
    ]
    expect(fixedSlotsOn(slots, "2026-09-29").map((s) => s.id)).toEqual(["b", "d", "a"])
  })

  it("los pausados no aparecen", () => {
    expect(fixedSlotsOn([slot({ active: false })], "2026-09-29")).toEqual([])
  })
})

describe("turnos fijos que todavía nadie ocupó", () => {
  const appt = (staffId: string, from: string, to: string, status: Appointment["status"] = "confirmado"): Appointment => ({
    id: from + staffId, clientId: "c", staffId, serviceId: "s",
    startsAt: at("2026-09-29", from).toISOString(), endsAt: at("2026-09-29", to).toISOString(),
    status, source: "walk_in", price: 0, notes: null, conversationId: null, holdExpiresAt: null, createdAt: "",
  })
  const fijo = slot({ start: "18:00", end: "19:00" })

  it("sin turno encima, el bloque fijo se muestra", () => {
    expect(pendingFixedSlots([fijo], [])).toHaveLength(1)
  })

  it("cuando el cliente llega y se lo anota en ese horario, deja de mostrarse el bloque (no se ve doble)", () => {
    expect(pendingFixedSlots([fijo], [appt("seba", "18:00", "19:00")])).toEqual([])
    expect(pendingFixedSlots([fijo], [appt("seba", "18:10", "19:10", "en_curso")])).toEqual([])
  })

  it("si un turno real sólo lo roza, el fijo se sigue mostrando (es un choque que hay que ver)", () => {
    // 16:35 a 17:35 contra un fijo de 18:00 a 19:00: no se tocan. Contra 17:15 a 18:00: 20 de 45 minutos.
    const f = slot({ start: "17:15", end: "18:00" })
    expect(pendingFixedSlots([f], [appt("seba", "16:35", "17:35")])).toHaveLength(1)
    expect(pendingFixedSlots([f], [appt("seba", "17:10", "18:10")])).toEqual([]) // lo cubre entero
  })

  it("un turno de otro barbero, o en otro horario, o cancelado, no lo tapa", () => {
    expect(pendingFixedSlots([fijo], [appt("nemo", "18:00", "19:00")])).toHaveLength(1)
    expect(pendingFixedSlots([fijo], [appt("seba", "16:00", "17:00")])).toHaveLength(1)
    expect(pendingFixedSlots([fijo], [appt("seba", "18:00", "19:00", "cancelado")])).toHaveLength(1)
  })
})

describe("turnos fijos que se pisan", () => {
  const f = (over: Partial<FixedSlot>) => slot({ start: "17:00", end: "17:45", ...over })

  it("dos del mismo barbero y día que comparten minutos se pisan", () => {
    expect(fixedSlotsClash(f({}), f({ start: "17:30", end: "18:15" }))).toBe(true)
  })

  it("pegados (uno termina cuando empieza el otro) no se pisan", () => {
    expect(fixedSlotsClash(f({}), f({ start: "17:45", end: "18:30" }))).toBe(false)
  })

  it("otro barbero, o otro día, no se pisan", () => {
    expect(fixedSlotsClash(f({}), f({ staffId: "nemo" }))).toBe(false)
    expect(fixedSlotsClash(f({}), f({ weekday: 3 }))).toBe(false)
  })

  it("uno de un día pisa al semanal si cae ese día de la semana", () => {
    // 2026-09-29 es martes; el semanal es de los martes.
    expect(fixedSlotsClash(f({}), f({ weekday: null, onDate: "2026-09-29" }))).toBe(true)
    expect(fixedSlotsClash(f({}), f({ weekday: null, onDate: "2026-09-30" }))).toBe(false) // miércoles
  })
})

describe("turnos fijos", () => {
  it("uno semanal cae todos los martes de la ventana", () => {
    // 2026-09-29 es martes.
    const blocks = expandFixedSlots([slot({})], "2026-09-29", 15)
    expect(blocks).toHaveLength(3) // 29/9, 6/10, 13/10
    expect(blocks[0].startsAt).toBe("2026-09-29T21:00:00.000Z") // 18:00 hora argentina (UTC−3)
    expect(blocks[0].endsAt).toBe("2026-09-29T22:00:00.000Z")
  })

  it("uno de un día cae una sola vez", () => {
    const blocks = expandFixedSlots([slot({ weekday: null, onDate: "2026-10-03" })], "2026-09-29", 30)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].startsAt.slice(0, 10)).toBe("2026-10-03")
  })

  it("uno pausado no bloquea nada", () => {
    expect(expandFixedSlots([slot({ active: false })], "2026-09-29", 30)).toEqual([])
  })

  it("saca ese horario (y sólo ese) de lo que se ofrece", () => {
    const blocks = expandFixedSlots([slot({})], "2026-09-29", 1)
    const staff = {
      id: "seba",
      skipsServiceIds: [],
      schedule: undefined,
      timeOff: blocks.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt })),
    }
    const free = freeSlots({
      day: "2026-09-29",
      service: { id: "corte", durationMin: 60 },
      staff,
      appointments: [],
      stepMin: 60,
      leadMin: 0,
      now: new Date("2026-09-28T12:00:00Z"),
    })
    expect(free).not.toContain("18:00")
    expect(free).toContain("17:00")
    expect(free).toContain("19:00")
  })
})
