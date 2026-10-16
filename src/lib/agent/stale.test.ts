import { describe, expect, it } from "vitest"
import { isStaleMessage } from "./stale"

describe("mensajes que llegan tarde", () => {
  const now = new Date("2026-10-15T21:00:00-03:00")
  it("un mensaje recién llegado lo contesta el agente", () => {
    expect(isStaleMessage("2026-10-15T20:58:00-03:00", now)).toBe(false)
  })
  it("uno reenviado horas después queda para una persona", () => {
    expect(isStaleMessage("2026-10-15T17:05:00-03:00", now)).toBe(true)
  })
  it("una fecha rota no frena al agente", () => {
    expect(isStaleMessage("no es una fecha", now)).toBe(false)
  })
})
