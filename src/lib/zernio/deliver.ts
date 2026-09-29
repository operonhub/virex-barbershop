import "server-only"
import { randomUUID } from "node:crypto"
import { readZernioConfig } from "./config"
import { sendMessage } from "./client"
import { isOwnAccount } from "./own-accounts"
import type { Conversation } from "@/lib/domain/types"

/** WhatsApp sólo deja escribir libremente dentro de las 24 h del último mensaje del cliente. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000

export function outsideWhatsAppWindow(conv: Pick<Conversation, "channel" | "lastInboundAt">, now: Date) {
  return conv.channel === "whatsapp" && (!conv.lastInboundAt || now.getTime() - new Date(conv.lastInboundAt).getTime() > WHATSAPP_WINDOW_MS)
}

export type DeliveryResult = { ok: true; sent: boolean; externalId: string | null } | { ok: false; error: string }

/**
 * Manda un mensaje al WhatsApp o Instagram del cliente por Zernio.
 *
 * Sin Zernio configurado (demo, desarrollo) no manda nada y lo dice
 * (`sent: false`): el mensaje igual queda en la Bandeja. Cada envío lleva una
 * Idempotency-Key nueva, así un reintento de red no le llega dos veces al cliente.
 */
export async function deliverToChannel(conv: Conversation, body: string, now: Date): Promise<DeliveryResult> {
  const config = readZernioConfig()
  if (!config.configured || !conv.externalId) return { ok: true, sent: false, externalId: null }
  if (outsideWhatsAppWindow(conv, now)) {
    return {
      ok: false,
      error: "Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp sólo deja escribirle con una plantilla aprobada. Esperá a que vuelva a escribir.",
    }
  }
  const accountId = conv.accountExternalId || process.env.ZERNIO_ACCOUNT_ID || ""
  // Nunca mandar desde una cuenta que no sea la de este panel (ver own-accounts.ts).
  if (!(await isOwnAccount(accountId))) {
    return { ok: false, error: "Esta conversación es de una cuenta que no pertenece a este panel: no se envía nada." }
  }
  const sent = await sendMessage({ config }, { conversationId: conv.externalId, accountId, body, idempotencyKey: randomUUID() })
  return sent.ok ? { ok: true, sent: true, externalId: sent.data.messageId } : { ok: false, error: `No se pudo enviar por Zernio: ${sent.message}` }
}
