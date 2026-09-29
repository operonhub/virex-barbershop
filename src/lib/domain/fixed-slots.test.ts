import { describe, expect, it } from "vitest"
import { expandFixedSlots, fixedSlotsOn, pendingFixedSlots } from "./fixed-slots"
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

  it("un turno de otro barbero, o en otro horario, o cancelado, no lo tapa", () => {
    expect(pendingFixedSlots([fijo], [appt("nemo", "18:00", "19:00")])).toHaveLength(1)
    expect(pendingFixedSlots([fijo], [appt("seba", "16:00", "17:00")])).toHaveLength(1)
    expect(pendingFixedSlots([fijo], [appt("seba", "18:00", "19:00", "cancelado")])).toHaveLength(1)
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
