import { describe, expect, it } from "vitest"
import { clientAgreedTo, hoursMentioned } from "./consent"

const u = (text: string) => ({ role: "user" as const, text })
const a = (text: string) => ({ role: "assistant" as const, text })

describe("hoursMentioned", () => {
  it("entiende las formas en que se pide una hora", () => {
    expect(hoursMentioned("el sábado a las 2 de la tarde")).toEqual([14])
    expect(hoursMentioned("tipo 17 o 18")).toEqual([17, 18])
    expect(hoursMentioned("a las 19:00 va")).toEqual([19])
    expect(hoursMentioned("a las siete")).toEqual([19])
    expect(hoursMentioned("al mediodía")).toEqual([12])
  })

  it("no confunde un teléfono ni una fecha con una hora", () => {
    expect(hoursMentioned("soy Martín, 11 5555 4444")).toEqual([])
    expect(hoursMentioned("el 26/09")).toEqual([])
  })
})

describe("clientAgreedTo", () => {
  it("vale la hora que pidió el cliente", () => {
    expect(clientAgreedTo("14:00", [u("me agendás el sábado a las 2?")])).toBe(true)
  })

  it("NO vale otra hora que el cliente nunca vio (el caso que lo motivó)", () => {
    expect(clientAgreedTo("19:00", [u("me agendás el sábado a las 2?")])).toBe(false)
  })

  it("vale una hora que el agente ofreció y el cliente respondió después", () => {
    const h = [u("el sábado a las 2?"), a("A las 14 no hay. Tengo 13:00 o 19:00, ¿te sirve?"), u("dale la de las 7")]
    expect(clientAgreedTo("19:00", h)).toBe(true)
    expect(clientAgreedTo("13:00", [u("el sábado a las 2?"), a("Tengo 13:00 o 19:00"), u("dale")])).toBe(true)
  })

  it("vale una hora en punto ofrecida como \"a las 18\" (caso real: dos turnos para amigos)", () => {
    const h = [u("dos turnos mañana"), a("Mañana a las 18 tengo un lugar con Sebastián, y el otro a las 19. ¿Te sirve?"), u("dale, esos")]
    expect(clientAgreedTo("18:00", h)).toBe(true)
    expect(clientAgreedTo("19:00", h)).toBe(true)
    expect(clientAgreedTo("18:30", h)).toBe(false)
    expect(clientAgreedTo("17:00", h)).toBe(false)
    expect(clientAgreedTo("18:00", [u("hola"), a("Tengo a las 18.30"), u("dale")])).toBe(false)
  })

  it("una fecha no cuenta como hora ofrecida", () => {
    expect(clientAgreedTo("18:00", [u("hola"), a("El jueves 18/10 tengo 15:00"), u("dale")])).toBe(false)
  })

  it("una oferta sin respuesta del cliente no alcanza", () => {
    expect(clientAgreedTo("19:00", [u("el sábado a las 2?"), a("Tengo 19:00")])).toBe(false)
  })

  it("sin mensajes del cliente, nunca", () => {
    expect(clientAgreedTo("11:00", [])).toBe(false)
  })
})
