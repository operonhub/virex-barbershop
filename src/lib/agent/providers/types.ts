/**
 * El idioma común entre el loop del agente y los proveedores de modelos.
 *
 * `run.ts` sólo habla en estos términos; cada proveedor (`anthropic.ts`,
 * `gemini.ts`) traduce a su API y guarda su propio historial — incluidos los
 * bloques que la API exige devolver tal cual (el razonamiento de Claude, las
 * firmas de pensamiento de Gemini). Por eso la sesión es un objeto con estado
 * y no una función pura: el loop nunca toca los mensajes crudos.
 */

export type AgentProvider = "gemini" | "anthropic"

export type AgentEffort = "low" | "medium" | "high"

export interface TurnInput {
  role: "user" | "assistant"
  text: string
}

/** JSON Schema de objeto: el mismo formato para los dos proveedores. */
export interface ToolParameters {
  type: "object"
  properties: Record<string, unknown>
  required: string[]
  additionalProperties: false
}

export interface ToolSpec {
  name: string
  description: string
  parameters: ToolParameters
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResult {
  callId: string
  name: string
  content: Record<string, unknown>
  isError?: boolean
}

export interface Usage {
  /** Entrada sin caché. */
  input: number
  /** Salida, incluido el razonamiento (se cobra como salida en los dos). */
  output: number
  cacheRead: number
  cacheWrite: number
}

export type StepResult =
  | { kind: "tool_calls"; calls: ToolCall[]; usage: Usage }
  | { kind: "reply"; text: string; usage: Usage; model: string }
  /** Cualquier cosa que no sea una respuesta usable: error de red, rechazo, corte por largo. */
  | { kind: "stop"; reason: string; usage: Usage }

export interface SessionInput {
  model: string
  effort: AgentEffort | null
  /** Parte estable del prompt (cacheable). */
  system: string
  /** Parte volátil: fecha, hora, ficha del cliente. */
  contextNote: string
  history: TurnInput[]
  tools: ToolSpec[]
}

export interface ModelSession {
  /** Pide el siguiente paso; `results` son las respuestas a las herramientas del paso anterior. */
  next(results?: ToolResult[]): Promise<StepResult>
}

export interface ModelProvider {
  readonly id: AgentProvider
  start(input: SessionInput): ModelSession
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** Contexto pegado al último mensaje del cliente, para modelos sin mensajes de sistema intermedios. */
export function withContext(text: string, contextNote: string) {
  return `${text}\n\n[Contexto del sistema — no es parte del mensaje del cliente]\n${contextNote}`
}

/** Las APIs exigen que la conversación arranque con el cliente. */
export function fromFirstUser(history: TurnInput[]) {
  const i = history.findIndex((m) => m.role === "user")
  return i === -1 ? [] : history.slice(i)
}
