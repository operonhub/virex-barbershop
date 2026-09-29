import { describe, expect, it } from "vitest"
import { expandFixedSlots } from "./fixed-slots"
import { freeSlots } from "./slots"
import type { FixedSlot } from "./types"

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
