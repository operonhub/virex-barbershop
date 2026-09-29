import "server-only"
import type { MercadoPagoConfig } from "./config"

/**
 * Cliente mínimo de Mercado Pago: crear la preferencia de pago (Checkout
 * Pro) y volver a consultar un pago por su id. Nada de SDK: son dos
 * pedidos HTTP, y así se controla el timeout y los reintentos igual que
 * con Zernio.
 */

const BASE_URL = "https://api.mercadopago.com"
const TIMEOUT_MS = 10_000

export type MpResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number }

async function request<T>(path: string, options: { method?: string; body?: unknown; idempotencyKey?: string }, config: MercadoPagoConfig): Promise<MpResult<T>> {
  if (!config.configured) return { ok: false, message: "Mercado Pago no está configurado." }
  const headers: Record<string, string> = { Authorization: `Bearer ${config.accessToken}`, Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"
  if (options.idempotencyKey) headers["X-Idempotency-Key"] = options.idempotencyKey

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  try {
    let res: Response
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: timeout.signal,
      })
    } catch (error) {
      return { ok: false, message: (error as Error)?.name === "AbortError" ? "Mercado Pago tardó demasiado en responder." : "No se pudo conectar con Mercado Pago." }
    }
    if (!res.ok) {
      let detail = ""
      try {
        const body = (await res.json()) as { message?: string }
        detail = body.message ?? ""
      } catch {
        /* sin cuerpo interpretable */
      }
      return { ok: false, status: res.status, message: `Mercado Pago respondió ${res.status}${detail ? `: ${detail}` : "."}` }
    }
    return { ok: true, data: (await res.json()) as T }
  } finally {
    clearTimeout(timer)
  }
}

export interface PreferenceInput {
  title: string
  amount: number
  /** Id del turno: llega de vuelta en el pago (`external_reference`) para saber a qué turno corresponde. */
  externalReference: string
  notificationUrl: string
  backUrl: string
  /** Minutos hasta que la preferencia deja de aceptar pagos (igual al tiempo que se reserva el horario). */
  expiresInMin: number
}

export interface Preference {
  id: string
  initPoint: string
}

/** Crea la preferencia de pago (Checkout Pro) para la seña de un turno. */
export async function createPreference(config: MercadoPagoConfig, input: PreferenceInput): Promise<MpResult<Preference>> {
  const now = new Date()
  const expiration = new Date(now.getTime() + input.expiresInMin * 60_000)
  const res = await request<{ id: string; init_point: string }>(
    "/checkout/preferences",
    {
      method: "POST",
      idempotencyKey: input.externalReference,
      body: {
        items: [{ title: input.title, quantity: 1, unit_price: input.amount, currency_id: "ARS" }],
        external_reference: input.externalReference,
        notification_url: input.notificationUrl,
        back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
        auto_return: "approved",
        expires: true,
        expiration_date_from: now.toISOString(),
        expiration_date_to: expiration.toISOString(),
      },
    },
    config
  )
  return res.ok ? { ok: true, data: { id: res.data.id, initPoint: res.data.init_point } } : res
}

export interface MpPayment {
  id: string
  status: string
  transactionAmount: number
  externalReference: string | null
}

/** Vuelve a pedirle el pago a la API: nunca se confía en lo que manda el webhook. */
export async function getPayment(config: MercadoPagoConfig, paymentId: string): Promise<MpResult<MpPayment>> {
  const res = await request<{ id: number; status: string; transaction_amount: number; external_reference: string | null }>(`/v1/payments/${encodeURIComponent(paymentId)}`, {}, config)
  return res.ok
    ? { ok: true, data: { id: String(res.data.id), status: res.data.status, transactionAmount: res.data.transaction_amount, externalReference: res.data.external_reference } }
    : res
}
