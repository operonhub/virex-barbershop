import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { readAgentConfig, supportsMidConversationSystem } from "./config"
import { executeTool, toolDefinitions, type ToolContext } from "./tools"
import type { AgentActionKind, AgentSettings, Service, Staff } from "@/lib/domain/types"

/**
 * El loop del agente: Claude + herramientas propias.
 *
 * Loop manual (no el tool runner beta) porque cada paso se registra y se
 * limita: máximo de iteraciones, permisos por herramienta, y el resultado
 * final se guarda como mensaje de la bandeja con la acción que ejecutó.
 *
 * Modelo: Claude Opus 5 por defecto, con `fallbacks: "default"` — si los
 * clasificadores de seguridad rechazan un pedido, la API lo reintenta con el
 * modelo de respaldo recomendado en el mismo llamado, en vez de dejar al
 * cliente sin respuesta.
 */

export interface TurnInput {
  role: "user" | "assistant"
  text: string
}

export interface AgentRunResult {
  ok: true
  reply: string
  actions: { tool: string; action?: AgentActionKind; isError?: boolean }[]
  clientId: string | null
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
  model: string
}

export type AgentRunFailure = { ok: false; reason: string }

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

export async function runAgent(args: {
  settings: AgentSettings
  services: Service[]
  staff: Staff[]
  history: TurnInput[]
  contextNote: string
  systemPrompt: string
  toolContext: ToolContext
}): Promise<AgentRunResult | AgentRunFailure> {
  const config = readAgentConfig()
  if (!config.configured) return { ok: false, reason: config.reason }

  const tools = toolDefinitions(args.services, args.staff)
  const messages: Anthropic.Beta.BetaMessageParam[] = toMessages(args.history, args.contextNote, config.model)
  const actions: AgentRunResult["actions"] = []
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let clientId = args.toolContext.clientId

  for (let i = 0; i < config.maxIterations; i++) {
    let response: Anthropic.Beta.BetaMessage
    try {
      response = await anthropic().beta.messages.create({
        model: config.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Prefijo estable (herramientas + system) con breakpoint de caché:
        // en una conversación larga se paga una vez, no en cada mensaje.
        system: [{ type: "text", text: args.systemPrompt, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
        ...(config.effort ? { output_config: { effort: config.effort } } : {}),
      })
    } catch (error) {
      return { ok: false, reason: describeError(error) }
    }

    usage.input += response.usage.input_tokens
    usage.output += response.usage.output_tokens
    usage.cacheRead += response.usage.cache_read_input_tokens ?? 0
    usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0

    if (response.stop_reason === "refusal") {
      return { ok: false, reason: "El modelo no quiso responder este mensaje. Queda para una persona." }
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, reason: "La respuesta se cortó por largo. Queda para una persona." }
    }

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "tool_use") {
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      // Todas las respuestas de herramientas van en UN solo mensaje: si se
      // separan, el modelo deja de pedir varias en paralelo.
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
      for (const call of calls) {
        const ctx = { ...args.toolContext, clientId }
        const outcome = await executeTool(call.name, (call.input ?? {}) as Record<string, unknown>, ctx)
        if (outcome.clientId) clientId = outcome.clientId
        actions.push({ tool: call.name, action: outcome.action, isError: outcome.isError })
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(outcome.result),
          ...(outcome.isError ? { is_error: true } : {}),
        })
      }
      messages.push({ role: "user", content: results })
      continue
    }

    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
    if (!reply) return { ok: false, reason: "El agente no generó respuesta." }
    return { ok: true, reply, actions, clientId, usage, model: response.model }
  }

  return { ok: false, reason: "El agente dio demasiadas vueltas sin responder. Queda para una persona." }
}

/**
 * Historial → mensajes de la API. El contexto volátil (fecha, ficha) va al
 * final como mensaje de sistema cuando el modelo lo soporta, o pegado al
 * último mensaje del cliente cuando no.
 */
function toMessages(history: TurnInput[], contextNote: string, model: string): Anthropic.Beta.BetaMessageParam[] {
  // La API exige que el primer mensaje sea del cliente.
  const trimmed = history.slice(history.findIndex((m) => m.role === "user"))
  const out: Anthropic.Beta.BetaMessageParam[] = trimmed.map((m) => ({ role: m.role, content: m.text }))
  if (supportsMidConversationSystem(model)) {
    out.push({ role: "system", content: `Contexto actual:\n${contextNote}` })
  } else {
    const last = out[out.length - 1]
    if (last?.role === "user") last.content = `${last.content}\n\n[Contexto del sistema — no es parte del mensaje del cliente]\n${contextNote}`
  }
  return out
}

/** Errores tipados, del más específico al más general. Nunca se muestra el cuerpo crudo. */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "La clave de Anthropic no es válida."
  if (error instanceof Anthropic.RateLimitError) return "Se alcanzó el límite de pedidos a la IA. Reintentá en un minuto."
  if (error instanceof Anthropic.BadRequestError) return "La IA rechazó el pedido (configuración inválida)."
  if (error instanceof Anthropic.APIConnectionError) return "No se pudo conectar con la IA."
  if (error instanceof Anthropic.APIError) return `La IA respondió con un error (${error.status}).`
  return "Error inesperado al llamar a la IA."
}
