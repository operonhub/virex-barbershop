/**
 * Configuración de Mercado Pago. Mismo contrato que `readZernioConfig`: si
 * falta algo, se declara no configurado y dice por qué.
 *
 * Todas las variables son de servidor: la clave de Mercado Pago mueve
 * dinero de verdad, nunca puede llegar al navegador.
 */

export type MercadoPagoConfig =
  | { configured: true; accessToken: string }
  | { configured: false; reason: string }

export type MercadoPagoWebhookConfig =
  | { configured: true; secret: string }
  | { configured: false; reason: string }

const MIN_WEBHOOK_SECRET_LENGTH = 16

export function readMercadoPagoConfig(env: Record<string, string | undefined> = process.env): MercadoPagoConfig {
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    return { configured: false, reason: "Falta MERCADOPAGO_ACCESS_TOKEN. Se crea en el panel de desarrolladores de Mercado Pago (con la cuenta del local)." }
  }
  return { configured: true, accessToken }
}

export function readMercadoPagoWebhookConfig(env: Record<string, string | undefined> = process.env): MercadoPagoWebhookConfig {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return { configured: false, reason: "Falta MERCADOPAGO_WEBHOOK_SECRET (se copia al dar de alta la notificación webhook en Mercado Pago)." }
  }
  if (secret.length < MIN_WEBHOOK_SECRET_LENGTH) {
    return { configured: false, reason: `MERCADOPAGO_WEBHOOK_SECRET parece incompleto (mínimo ${MIN_WEBHOOK_SECRET_LENGTH} caracteres).` }
  }
  return { configured: true, secret }
}
