import { describe, expect, it } from "vitest"
import { freeSlots, isOpen } from "./slots"
import { at } from "@/lib/time"
import type { Appointment } from "./types"

// Viernes 18/09/2026 (Virex abre martes a sábado, 11 a 20).
const DAY = "2026-09-18"
const corte = { id: "sv-corte", durationMin: 40 }
const leo = { id: "st-leo", skipsServiceIds: [] as string[] }

const appt = (from: string, to: string, status: Appointment["status"] = "confirmado"): Appointment => ({
  id: from, clientId: "c", staffId: "st-leo", serviceId: "sv-corte",
  startsAt: at(DAY, from).toISOString(), endsAt: at(DAY, to).toISOString(),
  status, source: "panel", price: 0, notes: null, conversationId: null, createdAt: "",
})

const early = new Date("2026-09-17T12:00:00-03:00")

describe("freeSlots", () => {
  it("no ofrece nada los días cerrados", () => {
    expect(isOpen("2026-09-20")).toBe(false) // domingo
    expect(freeSlots({ day: "2026-09-20", service: corte, staff: leo, appointments: [], now: early })).toEqual([])
  })

  it("el turno tiene que terminar antes del cierre", () => {
    const slots = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [], now: early })
    expect(slots[0]).toBe("11:00")
    expect(slots.at(-1)).toBe("19:15") // 19:15 + 40' = 19:55; 19:30 terminaría 20:10
  })

  it("respeta los turnos tomados y libera los cancelados", () => {
    const taken = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [appt("15:00", "15:40")], now: early })
    expect(taken).not.toContain("15:00")
    expect(taken).not.toContain("14:30") // 14:30–15:10 pisa el de las 15
    expect(taken).toContain("14:15")
    expect(taken).toContain("15:45")
    const cancelled = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [appt("15:00", "15:40", "cancelado")], now: early })
    expect(cancelled).toContain("15:00")
  })

  it("hoy no ofrece horarios dentro de la anticipación mínima", () => {
    const now = new Date("2026-09-18T16:40:00-03:00")
    const slots = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [], now, leadMin: 30 })
    expect(slots[0]).toBe("17:15")
  })

  it("no ofrece un servicio que el barbero no hace", () => {
    const thiago = { id: "st-thiago", skipsServiceIds: ["sv-color"] }
    expect(freeSlots({ day: DAY, service: { id: "sv-color", durationMin: 120 }, staff: thiago, appointments: [], now: early })).toEqual([])
  })
})
