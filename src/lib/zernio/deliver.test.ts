import { describe, expect, it } from "vitest"
import { outsideWhatsAppWindow, WHATSAPP_WINDOW_MS } from "./deliver"

const now = new Date("2026-09-27T12:00:00-03:00")

describe("outsideWhatsAppWindow", () => {
  it("adentro de las 24 h desde el último mensaje del cliente: se puede escribir libre", () => {
    const conv = { channel: "whatsapp" as const, lastInboundAt: new Date(now.getTime() - 10 * 3_600_000).toISOString() }
    expect(outsideWhatsAppWindow(conv, now)).toBe(false)
  })

  it("pasadas las 24 h: hace falta plantilla", () => {
    const conv = { channel: "whatsapp" as const, lastInboundAt: new Date(now.getTime() - WHATSAPP_WINDOW_MS - 60_000).toISOString() }
    expect(outsideWhatsAppWindow(conv, now)).toBe(true)
  })

  it("sin ningún mensaje del cliente todavía: fuera de ventana", () => {
    expect(outsideWhatsAppWindow({ channel: "whatsapp", lastInboundAt: null }, now)).toBe(true)
  })

  it("Instagram no tiene ventana de 24 h", () => {
    expect(outsideWhatsAppWindow({ channel: "instagram", lastInboundAt: null }, now)).toBe(false)
  })
})
