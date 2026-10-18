/**
 * Una línea por herramienta para `agent_runs.tools`: con qué datos la llamó el modelo y qué le devolvió.
 *
 * Existe porque el 17/10 el agente dijo "no quedan horarios con Sebastián" cuando el cálculo daba 18:00
 * y 18:45, y no había forma de saber si consultó otro día, otro servicio u otro barbero. Nunca guarda el
 * nombre ni el teléfono del cliente. Módulo puro, con tests.
 */
const KEPT = ["fecha", "hora", "desde_hora", "servicio_id", "barbero_id", "turno_id"] as const

export function traceTool(
  name: string,
  input: Record<string, unknown>,
  result: unknown,
  names: { services: Record<string, string>; staff: Record<string, string> }
): string {
  const args = KEPT.filter((k) => input[k] !== undefined && input[k] !== "")
    .map((k) => {
      const v = String(input[k])
      const label = k === "servicio_id" ? (names.services[v] ?? v) : k === "barbero_id" ? (names.staff[v] ?? v) : v
      return `${k.replace("_id", "")}=${label}`
    })
    .join(", ")
  return `${name}(${args}) → ${summarize(result)}`
}

function summarize(result: unknown): string {
  if (!result || typeof result !== "object") return String(result)
  const r = result as Record<string, unknown>
  if (r.ok === false) return `error: ${String(r.error ?? r.motivo ?? "sin detalle").slice(0, 120)}`
  if (r.cerrado) return `cerrado (próximo abierto ${String(r.proximo_dia_abierto)})`
  if (Array.isArray(r.horarios)) {
    const horas = (r.horarios as { hora?: string; barbero?: string }[]).map((h) => (h.barbero ? `${h.hora} ${h.barbero}` : h.hora))
    const extra = r.proximo_dia_con_lugar ? ` · próximo con lugar: ${JSON.stringify(r.proximo_dia_con_lugar).slice(0, 160)}` : ""
    return (horas.length ? horas.join(", ") : "sin horarios") + extra
  }
  return "ok"
}
