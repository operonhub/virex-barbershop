/**
 * Reintentos acotados para llamadas que pueden fallar un instante (límite de
 * uso, corte de red, error 5xx del otro lado).
 *
 * Existe porque el webhook de WhatsApp tiene 60 s para todo (el agente piensa,
 * usa herramientas y responde): un tropiezo pasajero de Gemini o de Zernio no
 * tiene que dejar al cliente sin respuesta, pero tampoco se puede esperar sin
 * límite. Por eso lleva un PRESUPUESTO de tiempo: si otra espera ya no entra,
 * se corta y se devuelve el último resultado.
 *
 * Módulo puro (el reloj y la espera se inyectan), probado con Vitest.
 */

export type Outcome<T> = { failed: false; value: T } | { failed: true; error: unknown }

export interface RetryOptions {
  /** Espera antes de cada reintento, en ms. Su largo es la cantidad máxima de reintentos. */
  delaysMs: number[]
  /** Tiempo total tras el cual no se empieza otra espera. */
  budgetMs?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Corre `run`; si el resultado (o el error) es reintentable, espera y vuelve a
 * intentar. Devuelve el último valor o relanza el último error.
 */
export async function retrying<T>(run: () => Promise<T>, retryable: (outcome: Outcome<T>) => boolean, options: RetryOptions): Promise<T> {
  const { delaysMs, budgetMs = Infinity, sleep = defaultSleep, now = Date.now } = options
  const start = now()
  for (let attempt = 0; ; attempt++) {
    let outcome: Outcome<T>
    try {
      outcome = { failed: false, value: await run() }
    } catch (error) {
      outcome = { failed: true, error }
    }
    const delay = delaysMs[attempt]
    const again = delay !== undefined && retryable(outcome) && now() - start + delay < budgetMs
    if (!again) {
      if (outcome.failed) throw outcome.error
      return outcome.value
    }
    await sleep(delay)
  }
}
