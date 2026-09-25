import { describe, expect, it } from "vitest"
import { freeSlots, isOpen, worksOn } from "./slots"
import { at } from "@/lib/time"
import type { Appointment } from "./types"

// Viernes 18/09/2026 (Virex abre martes a sábado, 11 a 20).
const DAY = "2026-09-18"
const corte = { id: "sv-corte", durationMin: 40 }
const leo = { id: "st-leo", skipsServiceIds: [] as string[] }
// Estos tests prueban la lógica con una grilla fina; la del local (1 h) tiene el suyo abajo.
const fine = { stepMin: 15 }

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
    const slots = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [], now: early, ...fine })
    expect(slots[0]).toBe("11:00")
    expect(slots.at(-1)).toBe("19:15") // 19:15 + 40' = 19:55; 19:30 terminaría 20:10
  })

  it("respeta los turnos tomados y libera los cancelados", () => {
    const taken = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [appt("15:00", "15:40")], now: early, ...fine })
    expect(taken).not.toContain("15:00")
    expect(taken).not.toContain("14:30") // 14:30–15:10 pisa el de las 15
    expect(taken).toContain("14:15")
    expect(taken).toContain("15:45")
    const cancelled = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [appt("15:00", "15:40", "cancelado")], now: early, ...fine })
    expect(cancelled).toContain("15:00")
  })

  it("hoy no ofrece horarios dentro de la anticipación mínima", () => {
    const now = new Date("2026-09-18T16:40:00-03:00")
    const slots = freeSlots({ day: DAY, service: corte, staff: leo, appointments: [], now, leadMin: 30, ...fine })
    expect(slots[0]).toBe("17:15")
  })

  it("por defecto ofrece la grilla del local: turnos de una hora, en punto", () => {
    const hora = { id: "sv-corte", durationMin: 60 }
    const slots = freeSlots({ day: DAY, service: hora, staff: leo, appointments: [appt("15:00", "16:00")], now: early })
    expect(slots).toEqual(["11:00", "12:00", "13:00", "14:00", "16:00", "17:00", "18:00", "19:00"])
  })

  it("con horario propio, sólo ofrece sus franjas (y nada los días que no trabaja)", () => {
    const hora = { id: "sv-corte", durationMin: 60 }
    // Viernes 18/09 = 5. Trabaja 14 a 18 ese día; el jueves (4) no tiene franjas.
    const parcial = { ...leo, schedule: [{ weekday: 5, start: "14:00", end: "18:00" }] }
    expect(freeSlots({ day: DAY, service: hora, staff: parcial, appointments: [], now: early })).toEqual(["14:00", "15:00", "16:00", "17:00"])
    expect(freeSlots({ day: "2026-09-17", service: hora, staff: parcial, appointments: [], now: new Date("2026-09-16T12:00:00-03:00") })).toEqual([])
  })

  it("un franco bloquea sus horarios (y uno de todo el día, el día entero)", () => {
    const hora = { id: "sv-corte", durationMin: 60 }
    const turnoMedico = { ...leo, timeOff: [{ startsAt: at(DAY, "12:30").toISOString(), endsAt: at(DAY, "14:00").toISOString() }] }
    const slots = freeSlots({ day: DAY, service: hora, staff: turnoMedico, appointments: [], now: early })
    expect(slots).not.toContain("12:00") // 12–13 pisa 12:30
    expect(slots).not.toContain("13:00")
    expect(slots).toContain("14:00")
    const vacaciones = { ...leo, timeOff: [{ startsAt: at("2026-09-15", "00:00").toISOString(), endsAt: at("2026-09-20", "00:00").toISOString() }] }
    expect(freeSlots({ day: DAY, service: hora, staff: vacaciones, appointments: [], now: early })).toEqual([])
  })

  it("sabe si un barbero atiende ese día (horario y francos)", () => {
    expect(worksOn({ schedule: undefined }, DAY)).toBe(true) // sin horario propio: el del local
    expect(worksOn({ schedule: [{ weekday: 2, start: "11:00", end: "20:00" }] }, DAY)).toBe(false) // sólo martes
    const franco = { timeOff: [{ startsAt: at(DAY, "00:00").toISOString(), endsAt: at("2026-09-19", "00:00").toISOString() }] }
    expect(worksOn(franco, DAY)).toBe(false)
    const mediodia = { timeOff: [{ startsAt: at(DAY, "12:00").toISOString(), endsAt: at(DAY, "14:00").toISOString() }] }
    expect(worksOn(mediodia, DAY)).toBe(true)
  })

  it("no ofrece un servicio que el barbero no hace", () => {
    const thiago = { id: "st-thiago", skipsServiceIds: ["sv-color"] }
    expect(freeSlots({ day: DAY, service: { id: "sv-color", durationMin: 120 }, staff: thiago, appointments: [], now: early })).toEqual([])
  })
})
