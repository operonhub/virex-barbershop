import { afterEach, describe, expect, it, vi } from "vitest"
import { isValidSession, passwordMatches, sessionToken } from "./session"

afterEach(() => vi.unstubAllEnvs())

describe("login simple del panel", () => {
  it("con contraseña: sólo abre la cookie firmada con esa contraseña", () => {
    vi.stubEnv("PANEL_PASSWORD", "correcta")
    expect(isValidSession(sessionToken("correcta"))).toBe(true)
    expect(isValidSession(sessionToken("otra"))).toBe(false)
    expect(isValidSession(undefined)).toBe(false)
  })

  it("cambiar la contraseña invalida las sesiones abiertas", () => {
    const vieja = sessionToken("vieja")
    vi.stubEnv("PANEL_PASSWORD", "nueva")
    expect(isValidSession(vieja)).toBe(false)
  })

  it("en producción sin contraseña, el panel queda cerrado", () => {
    vi.stubEnv("PANEL_PASSWORD", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(isValidSession(undefined)).toBe(false)
    expect(passwordMatches("")).toBe(false)
  })

  it("en desarrollo sin contraseña, queda abierto", () => {
    vi.stubEnv("PANEL_PASSWORD", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(isValidSession(undefined)).toBe(true)
  })

  it("compara la contraseña exacta", () => {
    vi.stubEnv("PANEL_PASSWORD", "Virex2026")
    expect(passwordMatches("Virex2026")).toBe(true)
    expect(passwordMatches("virex2026")).toBe(false)
  })
})
