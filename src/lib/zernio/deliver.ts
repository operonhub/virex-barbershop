import "server-only"
import { randomUUID } from "node:crypto"
import { readZernioConfig } from "./config"
import { sendMessage, type ZernioResult } from "./client"
import { isOwnAccount } from "./own-accounts"
import { retrying } from "@/lib/retry"
import type { Conversation } from "@/lib/domain/types"

/** WhatsApp sólo deja escribir libremente dentro de las 24 h del último mensaje del cliente. */
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000

export function outsideWhatsAppWindow(conv: Pick<Conversation, "channel" | "lastInboundAt">, now: Date) {
  return conv.channel === "whatsapp" && (!conv.lastInboundAt || now.getTime() - new Date(conv.lastInboundAt).getTime() > WHATSAPP_WINDOW_MS)
}

/** Fallos de Zernio que suelen pasar solos (límite de uso, error del servicio, red, demora). El resto no se reintenta. */
export function isTransientZernioFailure(result: ZernioResult<unknown>): boolean {
  return !result.ok && (result.code === "rate_limited" || result.code === "upstream" || result.code === "timeout" || result.code === "network")
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
  // Una sola clave para todos los intentos: si el primero llegó y sólo falló la
  // respuesta, Zernio contesta lo mismo en vez de mandarle el mensaje dos veces al cliente.
  const idempotencyKey = randomUUID()
  const sent = await retrying(
    () => sendMessage({ config }, { conversationId: conv.externalId!, accountId, body, idempotencyKey }),
    (o) => !o.failed && isTransientZernioFailure(o.value),
    { delaysMs: [1_000, 2_500], budgetMs: 15_000 }
  )
  return sent.ok ? { ok: true, sent: true, externalId: sent.data.messageId } : { ok: false, error: `No se pudo enviar por Zernio: ${sent.message}` }
}
