/**
 * Configuración del agente IA. Mismo contrato que `readZernioConfig`: si falta
 * algo, se declara no configurado y dice por qué — la pantalla del agente usa
 * ese texto en vez de fingir una respuesta.
 *
 * Todo es de servidor (sin NEXT_PUBLIC_): la clave de Anthropic nunca viaja
 * al navegador.
 */

export type AgentEffort = "low" | "medium" | "high" | "xhigh" | "max"

export type AgentConfig =
  | { configured: true; model: string; effort: AgentEffort | null; maxIterations: number }
  | { configured: false; reason: string }

/**
 * Modelo por defecto: Claude Opus 5. Se puede cambiar con AGENT_MODEL (por
 * ejemplo `claude-sonnet-5` o `claude-haiku-4-5`, más baratos) — es una
 * decisión de costo que se toma midiendo conversaciones reales, no a priori.
 */
export const DEFAULT_AGENT_MODEL = "claude-opus-5"

const EFFORTS: AgentEffort[] = ["low", "medium", "high", "xhigh", "max"]

export function readAgentConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  if (!env.ANTHROPIC_API_KEY?.trim()) {
    return {
      configured: false,
      reason: "Falta ANTHROPIC_API_KEY en el entorno del servidor. Sin ella el agente no puede responder.",
    }
  }
  const effort = env.AGENT_EFFORT?.trim() as AgentEffort | undefined
  return {
    configured: true,
    model: env.AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL,
    // Sin valor = el default de la API (high). Para chat de reservas vale la
    // pena medir `medium`/`low`: responde más rápido y suele alcanzar.
    effort: effort && EFFORTS.includes(effort) ? effort : null,
    maxIterations: 6,
  }
}

/**
 * Los mensajes de sistema a mitad de conversación (donde va el contexto que
 * cambia: fecha, hora, ficha del cliente) existen en Opus 5 / 4.8 y Fable,
 * pero no en Sonnet ni Haiku. Con esos modelos el contexto viaja pegado al
 * último mensaje del cliente.
 */
export function supportsMidConversationSystem(model: string) {
  return /^claude-(opus-(5|4-8)|fable|mythos)/.test(model)
}
