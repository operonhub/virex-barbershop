/**
 * ¿El mensaje del cliente llegó demasiado tarde para que lo conteste el agente?
 *
 * Pasa cuando Zernio reenvía mensajes que el panel no pudo guardar (una caída, un deploy roto): el
 * agente contestaría horas después, quizás de noche, y sin contexto de lo que pasó en el medio. Esos
 * mensajes entran a la Bandeja igual, pero los contesta una persona. Módulo puro, con tests.
 */
export const STALE_AFTER_MS = 15 * 60_000

export function isStaleMessage(sentAt: string, now: Date, maxAgeMs = STALE_AFTER_MS): boolean {
  const t = new Date(sentAt).getTime()
  return Number.isFinite(t) && now.getTime() - t > maxAgeMs
}
