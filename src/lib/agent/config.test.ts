import { describe, expect, it } from "vitest"
import { readFallbacks } from "./config"

describe("readFallbacks", () => {
  const gemini = { provider: "gemini" as const, model: "gemini-3.5-flash-lite" }

  it("sin claves extra, respalda con otro modelo de Gemini", () => {
    expect(readFallbacks(gemini, {})).toEqual([{ provider: "gemini", model: "gemini-3.5-flash" }])
  })

  it("con clave de Anthropic suma Claude como segundo respaldo", () => {
    expect(readFallbacks(gemini, { ANTHROPIC_API_KEY: "x" })).toEqual([
      { provider: "gemini", model: "gemini-3.5-flash" },
      { provider: "anthropic", model: "claude-haiku-4-5" },
    ])
  })

  it("los modelos de respaldo se pueden elegir por variable", () => {
    expect(readFallbacks(gemini, { ANTHROPIC_API_KEY: "x", AGENT_FALLBACK_MODEL: "gemini-3.5-flash", AGENT_FALLBACK_OTHER_MODEL: "claude-otro" })).toEqual([
      { provider: "gemini", model: "gemini-3.5-flash" },
      { provider: "anthropic", model: "claude-otro" },
    ])
  })

  it("no repite el modelo principal como respaldo", () => {
    expect(readFallbacks({ provider: "gemini", model: "gemini-3.5-flash" }, {})).toEqual([])
  })
})
