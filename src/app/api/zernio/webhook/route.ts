import { after, NextResponse, type NextRequest } from "next/server"
import { readZernioWebhookConfig } from "@/lib/zernio/config"
import { normalizeInboxEvent } from "@/lib/zernio/events"
import { readSignatureHeader, verifySignature } from "@/lib/zernio/signature"
import { ingestInboxEvent, respondToConversation } from "@/lib/agent/respond"

/**
 * Webhook del inbox de Zernio: WhatsApp e Instagram entran por acá.
 * Portado de operon-crm (verificado end-to-end en producción).
 *
 * Tres reglas del contrato de Zernio, no negociables:
 *  1. Responder 2xx en menos de 5 s: si no, cuenta como fallido y se
 *     reintenta hasta 7 veces. Por eso el agente NO corre dentro del request:
 *     se agenda con `after()`, que se ejecuta cuando la respuesta ya salió.
 *  2. Un evento que no se entiende también se responde 200: devolver error
 *     haría que Zernio reintente siete veces algo que va a fallar igual.
 *  3. Entrega at-least-once: el mismo evento puede llegar repetido. Se
 *     deduplica por id de mensaje (con Supabase, índice único en la tabla).
 */

// Hasta 60 s para que el agente piense y use herramientas después de responder.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const config = readZernioWebhookConfig()
  if (!config.configured) {
    // Sin secreto no se puede verificar nada; aceptar a ciegas dejaría que
    // cualquiera inyecte mensajes en la Bandeja.
    return NextResponse.json({ ok: false, error: "endpoint no configurado" }, { status: 503 })
  }

  // El cuerpo CRUDO: la firma se calcula sobre estos bytes exactos.
  const rawBody = await req.text()
  if (!verifySignature(rawBody, readSignatureHeader(req.headers), config.secret)) {
    return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true, status: "invalid" })
  }

  const event = normalizeInboxEvent(payload)
  if (event.kind !== "inbox") return NextResponse.json({ ok: true, status: event.kind })

  try {
    const conversationId = await ingestInboxEvent(event)
    if (conversationId) {
      after(async () => {
        const res = await respondToConversation(conversationId)
        if (!res.ok) console.warn("[agente] no respondió", { conversationId, reason: res.reason })
      })
    }
    return NextResponse.json({ ok: true, status: "processed" })
  } catch (error) {
    // 500 sólo cuando el fallo es nuestro: ahí el reintento de Zernio sí sirve.
    console.error("[zernio] error guardando el evento", { name: (error as Error)?.name })
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 })
  }
}
