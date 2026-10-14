/**
 * Una respuesta del agente por conversación, por vez.
 *
 * Existe porque la gente escribe en ráfagas ("Este mismo" y el número, en dos mensajes): cada mensaje
 * disparaba su propia corrida, las dos agendaban a la vez y la segunda contestaba "se me ocupó" con el
 * turno que acababa de crear la primera. Reglas:
 *  1. Antes de responder se espera `settleMs`; si en ese tiempo llegó otro mensaje, esta llamada no
 *     hace nada: la del mensaje nuevo responde y ve los dos.
 *  2. Si ya hay una corrida en curso para esa conversación, se espera a que termine (así lee el hilo
 *     con la respuesta anterior ya guardada).
 *
 * En memoria: alcanza porque producción es un solo servidor (Railway). Módulo puro, con tests.
 */
export function createConversationQueue<T>(run: (id: string) => Promise<T>, skipped: T, settleMs: number) {
  const latest = new Map<string, number>()
  const running = new Map<string, Promise<unknown>>()
  let seq = 0

  return async function respond(id: string): Promise<T> {
    const call = ++seq
    latest.set(id, call)
    if (settleMs > 0) await new Promise((r) => setTimeout(r, settleMs))
    if (latest.get(id) !== call) return skipped

    const previous = running.get(id) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(() => run(id))
    running.set(id, current)
    try {
      return await current
    } finally {
      if (running.get(id) === current) running.delete(id)
      if (latest.get(id) === call) latest.delete(id)
    }
  }
}
