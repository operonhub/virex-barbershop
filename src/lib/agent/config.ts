import type { AgentEffort, AgentProvider, Usage } from "./providers/types"

/**
 * Configuración del agente IA. Mismo contrato que `readZernioConfig`: si falta
 * algo, se declara no configurado y dice por qué — la pantalla del agente usa
 * ese texto en vez de fingir una respuesta.
 *
 * El proveedor es intercambiable por variable (`AGENT_PROVIDER`), así el
 * modelo se elige por barbería según costo y resultados, sin tocar código.
 * Todo es de servidor (sin NEXT_PUBLIC_): las claves nunca viajan al navegador.
 */

export type AgentConfig =
  | { configured: true; provider: AgentProvider; model: string; effort: AgentEffort | null; maxIterations: number }
  | { configured: false; provider: AgentProvider; reason: string }

/**
 * Por defecto, Gemini 3.5 Flash-Lite: para reservas (charla corta, 7
 * herramientas) alcanza y cuesta centavos por mes. La clave tiene que ser de
 * un proyecto CON facturación: en la capa gratuita Google usa el contenido
 * para mejorar sus productos, y acá son chats de clientes reales.
 */
export const DEFAULT_PROVIDER: AgentProvider = "gemini"

export const DEFAULT_MODEL: Record<AgentProvider, string> = {
  gemini: "gemini-3.5-flash-lite",
  anthropic: "claude-haiku-4-5",
}

const KEY_VAR: Record<AgentProvider, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
}

export const PROVIDER_LABEL: Record<AgentProvider, string> = {
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
}

const EFFORTS: AgentEffort[] = ["low", "medium", "high"]

export function readAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const raw = env.AGENT_PROVIDER?.trim().toLowerCase()
  if (raw && raw !== "gemini" && raw !== "anthropic") {
    return { configured: false, provider: DEFAULT_PROVIDER, reason: `AGENT_PROVIDER="${raw}" no existe: usá "gemini" o "anthropic".` }
  }
  const provider: AgentProvider = (raw as AgentProvider | undefined) ?? DEFAULT_PROVIDER
  const keyVar = KEY_VAR[provider]
  if (!env[keyVar]?.trim()) {
    return {
      configured: false,
      provider,
      reason: `Falta ${keyVar} en el entorno del servidor. Sin ella el agente no puede responder.`,
    }
  }
  const effort = env.AGENT_EFFORT?.trim().toLowerCase() as AgentEffort | undefined
  return {
    configured: true,
    provider,
    model: env.AGENT_MODEL?.trim() || DEFAULT_MODEL[provider],
    // Vacío = lo que decida cada modelo por defecto. Para reservas, `low`
    // suele alcanzar y responde más rápido.
    effort: effort && EFFORTS.includes(effort) ? effort : null,
    maxIterations: 6,
  }
}

/**
 * Precios en USD por millón de tokens (entrada, salida), para estimar el
 * costo de cada corrida. Fuente: páginas oficiales al 23/09/2026. Es una
 * estimación para comparar modelos: la factura real la da cada consola.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
}

/** Costo estimado en USD, o null si el modelo no está en la tabla. Caché: lectura al 10 %, escritura al 125 %. */
export function estimateCostUsd(model: string, usage: Usage): number | null {
  const p = PRICES[model]
  if (!p) return null
  const input = usage.input + usage.cacheRead * 0.1 + usage.cacheWrite * 1.25
  return (input * p.input + usage.output * p.output) / 1_000_000
}
