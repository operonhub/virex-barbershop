import "server-only"
import { headers } from "next/headers"
import { BRAND } from "@/config/brand"
import { readMercadoPagoConfig } from "./config"
import { createPreference } from "./client"

/**
 * El link de Checkout Pro para la seña de un turno. Lo usan tanto la reserva
 * pública (`/reservar`) como el agente por WhatsApp (`crear_turno`): mismo
 * armado, misma vuelta a `/pago`.
 *
 * `null` si Mercado Pago no está configurado o si Mercado Pago rechazó el
 * pedido — quien llama decide qué hacer (la reserva pública cancela el
 * turno; el agente lo dice y deriva a una persona).
 */
export async function startDepositCheckout(input: {
  appointmentId: string
  serviceName: string
  amount: number
  holdMin: number
}): Promise<string | null> {
  const config = readMercadoPagoConfig()
  if (!config.configured) return null

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return null
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const origin = `${proto}://${host}`

  const pref = await createPreference(config, {
    title: `Seña · ${input.serviceName} · ${BRAND.fullName}`,
    amount: input.amount,
    externalReference: input.appointmentId,
    notificationUrl: `${origin}/api/mercadopago/webhook`,
    backUrl: `${origin}/pago`,
    expiresInMin: input.holdMin,
  })
  return pref.ok ? pref.data.initPoint : null
}
