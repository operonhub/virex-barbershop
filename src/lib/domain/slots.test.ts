import { describe, expect, it } from "vitest"
import { checkManualBooking, freeSlots, isOpen, offHoursFor, worksOn } from "./slots"
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
  status, source: "panel", price: 0, notes: null, conversationId: null, holdExpiresAt: null, createdAt: "",
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

  it("el intervalo es configurable: con 45 minutos arrancan a las 11:00, 11:45, 12:30…", () => {
    const turno45 = { id: "sv-corte", durationMin: 45 }
    const slots = freeSlots({ day: DAY, service: turno45, staff: leo, appointments: [], now: early, stepMin: 45 })
    expect(slots.slice(0, 4)).toEqual(["11:00", "11:45", "12:30", "13:15"])
    expect(slots.at(-1)).toBe("19:15") // 19:15 + 45' = 20:00, justo al cierre
  })

  it("con 30 minutos hay el doble de horarios que con 60", () => {
    const hora = { id: "sv-corte", durationMin: 60 }
    const cada60 = freeSlots({ day: DAY, service: hora, staff: leo, appointments: [], now: early, stepMin: 60 })
    const cada30 = freeSlots({ day: DAY, service: hora, staff: leo, appointments: [], now: early, stepMin: 30 })
    expect(cada60).toHaveLength(9) // 11:00 a 19:00
    expect(cada30).toHaveLength(17) // 11:00, 11:30 … 19:00
    expect(cada30).toContain("11:30")
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

describe("barbero con corte al mediodía (dos franjas el mismo día)", () => {
  // Viernes: 11 a 14 y 15 a 20. Entre medio no atiende.
  const partido = {
    id: "st-leo",
    skipsServiceIds: [] as string[],
    schedule: [
      { weekday: 5, start: "11:00", end: "14:00" },
      { weekday: 5, start: "15:00", end: "20:00" },
    ],
  }
  const hora = { id: "sv-corte", durationMin: 60 }

  it("no ofrece nada durante el corte, y un turno tiene que terminar antes de que empiece", () => {
    const slots = freeSlots({ day: DAY, service: hora, staff: partido, appointments: [], now: early, stepMin: 30 })
    expect(slots).toContain("13:00") // 13:00–14:00 entra justo
    expect(slots).not.toContain("13:30") // terminaría 14:30, en pleno corte
    expect(slots).not.toContain("14:00")
    expect(slots).not.toContain("14:30")
    expect(slots).toContain("15:00")
  })

  it("sabe que atiende ese día aunque esté partido", () => {
    expect(worksOn(partido, DAY)).toBe(true)
  })
})

describe("horarios pegados al final de otro turno (sin huecos muertos)", () => {
  const de45 = { id: "sv-corte", durationMin: 45 }

  it("con un turno que termina 17:45, se ofrece 17:45 aunque la grilla sea de una hora", () => {
    const slots = freeSlots({ day: DAY, service: de45, staff: leo, appointments: [appt("17:00", "17:45")], now: early, stepMin: 60 })
    expect(slots).toContain("17:45")
    expect(slots).toContain("18:00") // y la grilla de siempre sigue
    expect(slots).not.toContain("17:00")
  })

  it("sin turnos no se inventa ninguna hora fuera de la grilla", () => {
    const slots = freeSlots({ day: DAY, service: de45, staff: leo, appointments: [], now: early, stepMin: 60 })
    expect(slots).not.toContain("17:45")
  })

  it("no ofrece un pegado que no entra antes del cierre", () => {
    const slots = freeSlots({ day: DAY, service: de45, staff: leo, appointments: [appt("18:30", "19:30")], now: early, stepMin: 60 })
    expect(slots).not.toContain("19:30") // 19:30 + 45 = 20:15, pasado el cierre
  })
})

describe("turno cargado a mano por el equipo (a cualquier minuto, con cualquier duración)", () => {
  const seba = { id: "st-leo", name: "Seba", skipsServiceIds: [] as string[], schedule: undefined, timeOff: undefined as { startsAt: string; endsAt: string }[] | undefined }
  const svc = { id: "sv-corte" }
  const base = { day: DAY, service: svc, staff: seba, appointments: [] as Appointment[], now: early }

  it("acepta 17:15 por 45 minutos: no hace falta que caiga en la grilla", () => {
    expect(checkManualBooking({ ...base, time: "17:15", durationMin: 45 })).toEqual({ ok: true, warnings: [] })
  })

  it("rechaza pisar a otro cliente, diciendo cuál", () => {
    const r = checkManualBooking({ ...base, appointments: [appt("17:00", "17:45")], time: "17:30", durationMin: 45 })
    expect(r).toMatchObject({ ok: false })
    expect(r.ok === false && r.error).toContain("17:00 a 17:45")
  })

  it("dos turnos pegados están bien: 17:45 después de uno que termina 17:45", () => {
    expect(checkManualBooking({ ...base, appointments: [appt("17:00", "17:45")], time: "17:45", durationMin: 45 }).ok).toBe(true)
  })

  it("rechaza el local cerrado y lo que se pasa del horario del local", () => {
    expect(checkManualBooking({ ...base, day: "2026-09-20", time: "12:00", durationMin: 60 }).ok).toBe(false) // domingo
    expect(checkManualBooking({ ...base, time: "19:30", durationMin: 60 }).ok).toBe(false) // termina 20:30
    expect(checkManualBooking({ ...base, time: "10:30", durationMin: 30 }).ok).toBe(false) // antes de abrir
  })

  it("hoy no deja cargar en el pasado, pero tolera a alguien que recién llegó", () => {
    const ahora = new Date("2026-09-18T16:40:00-03:00")
    expect(checkManualBooking({ ...base, now: ahora, time: "15:00", durationMin: 60 }).ok).toBe(false)
    expect(checkManualBooking({ ...base, now: ahora, time: "16:20", durationMin: 40 }).ok).toBe(true) // empezó hace 20 min
  })

  it("avisa, sin trabar, si es fuera del horario del barbero", () => {
    const partido = { ...seba, schedule: [{ weekday: 5, start: "11:00", end: "14:00" }, { weekday: 5, start: "15:00", end: "20:00" }] }
    const r = checkManualBooking({ ...base, staff: partido, time: "14:15", durationMin: 30 })
    expect(r.ok).toBe(true)
    expect(r.ok && r.warnings[0]).toContain("no trabaja en ese horario")
    expect(r.ok && r.warnings[0]).toContain("11:00 a 14:00 y 15:00 a 20:00")
  })

  it("avisa, sin trabar, si coincide con un franco o un turno fijo", () => {
    const conFijo = { ...seba, timeOff: [{ startsAt: at(DAY, "18:00").toISOString(), endsAt: at(DAY, "19:00").toISOString() }] }
    const r = checkManualBooking({ ...base, staff: conFijo, time: "18:00", durationMin: 60 })
    expect(r.ok).toBe(true)
    expect(r.ok && r.warnings.join(" ")).toContain("franco o un turno fijo")
  })

  it("no deja agendar un servicio que el barbero no hace", () => {
    expect(checkManualBooking({ ...base, staff: { ...seba, skipsServiceIds: ["sv-corte"] }, time: "12:00", durationMin: 60 }).ok).toBe(false)
  })
})

describe("cuándo NO atiende un barbero (para marcarlo en la agenda)", () => {
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  const view = (r: [number, number][]) => r.map(([a, b]) => `${hm(a)}-${hm(b)}`)

  it("sin horario propio, atiende todo el horario del local: no hay tramos libres", () => {
    expect(offHoursFor({ schedule: undefined }, DAY)).toEqual([])
  })

  it("con corte al mediodía, el corte es un tramo", () => {
    const s = { schedule: [{ weekday: 5, start: "11:00", end: "14:00" }, { weekday: 5, start: "15:00", end: "20:00" }] }
    expect(view(offHoursFor(s, DAY))).toEqual(["14:00-15:00"])
  })

  it("si entra tarde y sale temprano, se marcan los dos extremos", () => {
    const s = { schedule: [{ weekday: 5, start: "12:30", end: "18:00" }] }
    expect(view(offHoursFor(s, DAY))).toEqual(["11:00-12:30", "18:00-20:00"])
  })

  it("un día que no trabaja es todo el horario del local", () => {
    const s = { schedule: [{ weekday: 2, start: "11:00", end: "20:00" }] } // sólo los martes; DAY es viernes
    expect(view(offHoursFor(s, DAY))).toEqual(["11:00-20:00"])
  })
})
