import { NextResponse, type NextRequest } from "next/server"
import { db, now, store } from "@/lib/data/repo"
import { readMercadoPagoConfig, readMercadoPagoWebhookConfig } from "@/lib/mercadopago/config"
import { getPayment } from "@/lib/mercadopago/client"
import { verifyMercadoPagoSignature } from "@/lib/mercadopago/signature"

/**
 * Webhook de Mercado Pago: confirma la seña de un turno reservado desde
 * `/reservar` o por el agente.
 *
 * Reglas, calcadas del webhook de Zernio:
 *  1. Nunca se confía en el cuerpo de la notificación — sólo dice QUÉ pago
 *     mirar. El monto y el estado se vuelven a pedir a la API con nuestro
 *     propio access token antes de acreditar nada.
 *  2. Entrega al menos una vez: `confirmDeposit` es idempotente (un turno,
 *     una sola seña; un pago de MP, un solo registro), así que un reintento
 *     no duplica nada.
 *  3. Un evento que no corresponde procesar (no es un pago, no está
 *     aprobado, el turno no existe) también responde 200: reintentarlo no
 *     cambia nada.
 */
export async function POST(req: NextRequest) {
  const webhook = readMercadoPagoWebhookConfig()
  if (!webhook.configured) {
    return NextResponse.json({ ok: false, error: "endpoint no configurado" }, { status: 503 })
  }

  const url = new URL(req.url)
  let body: { type?: string; action?: string; data?: { id?: string } } = {}
  try {
    body = await req.json()
  } catch {
    /* algunas notificaciones viejas no traen cuerpo: se sigue con la query. */
  }

  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic")
  const dataId = body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id")

  if (type !== "payment") return NextResponse.json({ ok: true, status: "ignored" })
  if (!dataId) return NextResponse.json({ ok: false, error: "sin id de pago" }, { status: 400 })

  const signatureOk = verifyMercadoPagoSignature({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret: webhook.secret,
  })
  if (!signatureOk) return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 })

  const config = readMercadoPagoConfig()
  if (!config.configured) return NextResponse.json({ ok: false, error: "endpoint no configurado" }, { status: 503 })

  try {
    const payment = await getPayment(config, dataId)
    if (!payment.ok) {
      console.error("[mercadopago] no se pudo consultar el pago", { status: payment.status })
      return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 })
    }
    if (payment.data.status !== "approved") return NextResponse.json({ ok: true, status: payment.data.status })

    const appointmentId = payment.data.externalReference
    if (!appointmentId) return NextResponse.json({ ok: true, status: "sin_turno_asociado" })

    const s = await db()
    const appt = s.appointments.find((a) => a.id === appointmentId)
    if (!appt) {
      console.warn("[mercadopago] pago aprobado de un turno que ya no existe", { appointmentId })
      return NextResponse.json({ ok: true, status: "turno_inexistente" })
    }
    const service = s.services.find((x) => x.id === appt.serviceId)

    const { inserted } = await store().confirmDeposit(appointmentId, {
      appointmentId,
      clientId: appt.clientId,
      staffId: appt.staffId,
      serviceId: appt.serviceId,
      concept: `Seña · ${service?.name ?? "turno"}`,
      kind: "sena",
      listPrice: payment.data.transactionAmount,
      discount: 0,
      discountReason: null,
      tip: 0,
      amount: payment.data.transactionAmount,
      method: "mercadopago",
      paidAt: (await now()).toISOString(),
      externalRef: payment.data.id,
    })
    return NextResponse.json({ ok: true, status: inserted ? "confirmado" : "ya_estaba" })
  } catch (error) {
    console.error("[mercadopago] error procesando la notificación", { name: (error as Error)?.name })
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 })
  }
}
