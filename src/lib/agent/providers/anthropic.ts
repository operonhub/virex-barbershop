import "server-only"
import Anthropic from "@anthropic-ai/sdk"
import { fromFirstUser, NO_USAGE, withContext, type ModelProvider, type ModelSession, type SessionInput, type StepResult, type ToolSpec } from "./types"

/**
 * Proveedor Claude. Mantiene el historial en el formato de Anthropic y le
 * devuelve al loop pasos neutrales.
 *
 * Lo que depende del modelo:
 *  - `fallbacks: "default"` (beta) sólo en Opus 5 / Fable 5.x: si los
 *    clasificadores rechazan un pedido, la API lo reintenta con el modelo de
 *    respaldo en el mismo llamado. En Haiku y Sonnet no aplica.
 *  - `effort` no existe en Haiku 4.5 (lo rechaza con 400).
 *  - Mensajes de sistema a mitad de conversación: sólo Opus 5 / 4.8 y Fable.
 *    En el resto, el contexto va pegado al último mensaje del cliente.
 */

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic())

export const usesServerFallbacks = (model: string) => /^claude-(opus-5$|fable-5)/.test(model)
export const supportsEffort = (model: string) => !/^claude-(haiku|sonnet-4-5)/.test(model)
export const supportsMidConversationSystem = (model: string) => /^claude-(opus-(5|4-8)|fable|mythos)/.test(model)

export function toAnthropicTools(tools: ToolSpec[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => ({ name: t.name, description: t.description, strict: true, input_schema: { ...t.parameters } }))
}

export const anthropicProvider: ModelProvider = {
  id: "anthropic",
  start(input: SessionInput): ModelSession {
    const tools = toAnthropicTools(input.tools)
    const messages = toMessages(input)

    return {
      async next(results) {
        if (results?.length) {
          // Todas las respuestas de herramientas van en UN solo mensaje: si se
          // separan, el modelo deja de pedir varias en paralelo.
          messages.push({
            role: "user",
            content: results.map((r) => ({
              type: "tool_result" as const,
              tool_use_id: r.callId,
              content: JSON.stringify(r.content),
              ...(r.isError ? { is_error: true } : {}),
            })),
          })
        }

        let response: Anthropic.Beta.BetaMessage
        try {
          response = await anthropic().beta.messages.create({
            model: input.model,
            max_tokens: 16000,
            ...(usesServerFallbacks(input.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
            // Prefijo estable (herramientas + system) con breakpoint de caché.
            // Si queda por debajo del mínimo del modelo, simplemente no cachea.
            system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
            ...(input.effort && supportsEffort(input.model) ? { output_config: { effort: input.effort } } : {}),
          })
        } catch (error) {
          return { kind: "stop", reason: describeError(error), usage: NO_USAGE }
        }

        const usage = {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          cacheRead: response.usage.cache_read_input_tokens ?? 0,
          cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
        }

        if (response.stop_reason === "refusal") {
          return { kind: "stop", reason: "El modelo no quiso responder este mensaje. Queda para una persona.", usage }
        }
        if (response.stop_reason === "max_tokens") {
          return { kind: "stop", reason: "La respuesta se cortó por largo. Queda para una persona.", usage }
        }

        messages.push({ role: "assistant", content: response.content })

        if (response.stop_reason === "tool_use") {
          const calls = response.content
            .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
            .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }))
          return { kind: "tool_calls", calls, usage }
        }

        const text = response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim()
        return text ? ({ kind: "reply", text, usage, model: response.model } satisfies StepResult) : { kind: "stop", reason: "El agente no generó respuesta.", usage }
      },
    }
  },
}

function toMessages(input: SessionInput): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = fromFirstUser(input.history).map((m) => ({ role: m.role, content: m.text }))
  if (supportsMidConversationSystem(input.model)) {
    out.push({ role: "system", content: `Contexto actual:\n${input.contextNote}` })
  } else {
    const last = out[out.length - 1]
    if (last?.role === "user" && typeof last.content === "string") last.content = withContext(last.content, input.contextNote)
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
