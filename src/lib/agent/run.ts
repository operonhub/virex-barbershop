import "server-only"
import { estimateCostUsd, readAgentConfig } from "./config"
import { providerFor } from "./providers"
import type { ToolResult, TurnInput, Usage } from "./providers/types"
import { executeTool, toolDefinitions, type ToolContext } from "./tools"
import type { AgentActionKind, AgentSettings, Service, Staff } from "@/lib/domain/types"

/**
 * El loop del agente: modelo + herramientas propias.
 *
 * No sabe qué proveedor hay abajo (Gemini o Claude, según `AGENT_PROVIDER`):
 * pide pasos a una sesión neutral (`providers/types.ts`), ejecuta las
 * herramientas y devuelve la respuesta. Loop manual porque cada paso se
 * limita y registra: máximo de vueltas, permisos por herramienta, y la acción
 * que ejecutó queda en la bandeja.
 */

export type { TurnInput } from "./providers/types"

export interface AgentRunResult {
  ok: true
  reply: string
  actions: { tool: string; action?: AgentActionKind; isError?: boolean }[]
  clientId: string | null
  usage: Usage
  provider: string
  model: string
  /** Estimación para comparar modelos; null si el modelo no está en la tabla de precios. */
  costUsd: number | null
}

export type AgentRunFailure = { ok: false; reason: string }

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

  const session = providerFor(config.provider).start({
    model: config.model,
    effort: config.effort,
    system: args.systemPrompt,
    contextNote: args.contextNote,
    history: args.history,
    tools: toolDefinitions(args.services, args.staff),
  })

  const actions: AgentRunResult["actions"] = []
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
  let clientId = args.toolContext.clientId
  let results: ToolResult[] | undefined

  for (let i = 0; i < config.maxIterations; i++) {
    const step = await session.next(results)
    usage.input += step.usage.input
    usage.output += step.usage.output
    usage.cacheRead += step.usage.cacheRead
    usage.cacheWrite += step.usage.cacheWrite

    if (step.kind === "stop") return { ok: false, reason: step.reason }
    if (step.kind === "reply") {
      return {
        ok: true,
        reply: step.text,
        actions,
        clientId,
        usage,
        provider: config.provider,
        model: step.model,
        costUsd: estimateCostUsd(config.model, usage),
      }
    }

    results = []
    for (const call of step.calls) {
      const outcome = await executeTool(call.name, call.input, { ...args.toolContext, clientId, history: args.history })
      if (outcome.clientId) clientId = outcome.clientId
      actions.push({ tool: call.name, action: outcome.action, isError: outcome.isError })
      results.push({ callId: call.id, name: call.name, content: outcome.result, isError: outcome.isError })
    }
  }

  return { ok: false, reason: "El agente dio demasiadas vueltas sin responder. Queda para una persona." }
}
