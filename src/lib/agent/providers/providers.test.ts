import { describe, expect, it } from "vitest"
import { estimateCostUsd, readAgentConfig } from "../config"
import { supportsEffort, supportsMidConversationSystem, toAnthropicTools, usesServerFallbacks } from "./anthropic"
import { toGeminiTools } from "./gemini"
import { fromFirstUser, withContext, type ToolSpec } from "./types"

const TOOL: ToolSpec = {
  name: "consultar_disponibilidad",
  description: "Horarios libres.",
  parameters: {
    type: "object",
    properties: { fecha: { type: "string" }, barbero_id: { type: "string", enum: ["st-a", "cualquiera"] } },
    required: ["fecha", "barbero_id"],
    additionalProperties: false,
  },
}

describe("readAgentConfig", () => {
  it("usa Gemini 3.5 Flash-Lite por defecto", () => {
    const c = readAgentConfig({ GEMINI_API_KEY: "k" })
    expect(c).toMatchObject({ configured: true, provider: "gemini", model: "gemini-3.5-flash-lite", effort: null })
  })

  it("pide la clave del proveedor elegido, no la del otro", () => {
    const c = readAgentConfig({ AGENT_PROVIDER: "anthropic", GEMINI_API_KEY: "k" })
    expect(c.configured).toBe(false)
    if (!c.configured) expect(c.reason).toContain("ANTHROPIC_API_KEY")
  })

  it("con Anthropic, Haiku 4.5 por defecto; AGENT_MODEL lo pisa", () => {
    expect(readAgentConfig({ AGENT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })).toMatchObject({ model: "claude-haiku-4-5" })
    expect(readAgentConfig({ AGENT_PROVIDER: "Anthropic", ANTHROPIC_API_KEY: "k", AGENT_MODEL: "claude-sonnet-5" })).toMatchObject({ model: "claude-sonnet-5" })
  })

  it("rechaza un proveedor inexistente y un effort inválido", () => {
    expect(readAgentConfig({ AGENT_PROVIDER: "openai", GEMINI_API_KEY: "k" }).configured).toBe(false)
    expect(readAgentConfig({ GEMINI_API_KEY: "k", AGENT_EFFORT: "max" })).toMatchObject({ effort: null })
    expect(readAgentConfig({ GEMINI_API_KEY: "k", AGENT_EFFORT: "LOW" })).toMatchObject({ effort: "low" })
  })
})

describe("estimateCostUsd", () => {
  it("cobra entrada y salida por millón, y el caché con descuento", () => {
    const usage = { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }
    expect(estimateCostUsd("gemini-3.5-flash-lite", usage)).toBeCloseTo(2.8)
    expect(estimateCostUsd("claude-haiku-4-5", { ...usage, cacheRead: 1_000_000 })).toBeCloseTo(6.1)
  })

  it("devuelve null para un modelo sin precio cargado", () => {
    expect(estimateCostUsd("modelo-nuevo", { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 })).toBeNull()
  })
})

describe("traducción de herramientas", () => {
  it("Claude: mismo schema, con strict", () => {
    const [t] = toAnthropicTools([TOOL])
    expect(t).toMatchObject({ name: TOOL.name, strict: true, input_schema: TOOL.parameters })
  })

  it("Gemini: el JSON Schema va entero en parametersJsonSchema (conserva enum)", () => {
    const [t] = toGeminiTools([TOOL])
    expect(t).toEqual({ name: TOOL.name, description: TOOL.description, parametersJsonSchema: TOOL.parameters })
  })
})

describe("qué se manda según el modelo de Claude", () => {
  it("fallbacks sólo en Opus 5 y Fable 5.x", () => {
    expect(usesServerFallbacks("claude-opus-5")).toBe(true)
    expect(usesServerFallbacks("claude-fable-5-1")).toBe(true)
    expect(usesServerFallbacks("claude-haiku-4-5")).toBe(false)
    expect(usesServerFallbacks("claude-sonnet-5")).toBe(false)
  })

  it("effort no va a Haiku 4.5", () => {
    expect(supportsEffort("claude-haiku-4-5")).toBe(false)
    expect(supportsEffort("claude-sonnet-5")).toBe(true)
  })

  it("mensaje de sistema intermedio sólo en Opus 5 / 4.8 y Fable", () => {
    expect(supportsMidConversationSystem("claude-opus-5")).toBe(true)
    expect(supportsMidConversationSystem("claude-sonnet-5")).toBe(false)
    expect(supportsMidConversationSystem("claude-haiku-4-5")).toBe(false)
  })
})

describe("historial", () => {
  it("arranca en el primer mensaje del cliente", () => {
    expect(fromFirstUser([{ role: "assistant", text: "hola" }, { role: "user", text: "turno?" }])).toEqual([{ role: "user", text: "turno?" }])
    expect(fromFirstUser([{ role: "assistant", text: "hola" }])).toEqual([])
  })

  it("el contexto se marca como ajeno al mensaje del cliente", () => {
    expect(withContext("turno mañana?", "Hoy es martes")).toMatch(/^turno mañana\?\n\n\[Contexto del sistema — no es parte del mensaje del cliente\]\nHoy es martes$/)
  })
})
