import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Firma del webhook de Mercado Pago.
 *
 * MP manda `x-signature: ts=<epoch>,v1=<hex>` y `x-request-id`. El hash es
 * HMAC-SHA256 sobre el "manifest" `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
 * con el secreto que se copia al dar de alta la notificación en su panel.
 *
 * Verificado contra la documentación y el SDK oficial de Mercado Pago
 * (2026-09-27). Igual, esto es sólo la primera barrera: el webhook NUNCA
 * confía en los datos del cuerpo — siempre vuelve a consultar el pago a la
 * API con el access token propio antes de acreditar nada (mismo criterio
 * que el webhook de Zernio).
 */

export function parseXSignature(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((p): p is [string, string] => p.length === 2)
  )
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null
}

export function verifyMercadoPagoSignature(input: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
  secret: string
}): boolean {
  const sig = parseXSignature(input.xSignature)
  if (!sig || !input.xRequestId || !input.dataId) return false

  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${sig.ts};`
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex")

  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(sig.v1, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
