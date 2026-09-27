"use server"

import { headers } from "next/headers"
import { assertPanelSession } from "@/lib/auth/guard"
import { readZernioConfig } from "./config"
import { getConnectUrl } from "./client"

/**
 * Genera el link que se le manda al dueño para conectar su WhatsApp o su
 * Instagram. Cuando termina, Zernio lo devuelve a /conectado (página pública:
 * él no tiene la contraseña del panel).
 */
export async function createConnectLink(platform: "whatsapp" | "instagram"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await assertPanelSession()
  if (platform !== "whatsapp" && platform !== "instagram") return { ok: false, error: "Canal inválido." }
  const config = readZernioConfig()
  if (!config.configured) return { ok: false, error: config.reason }
  if (!config.profileId) {
    return { ok: false, error: "Falta ZERNIO_PROFILE_ID: creá en Zernio un profile para Virex (cada profile admite un solo WhatsApp)." }
  }

  // La dirección pública del panel, tal como la ve quien está usando el panel.
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  if (!host) return { ok: false, error: "No se pudo saber la dirección del panel." }
  const redirectUrl = `${proto}://${host}/conectado?canal=${platform}`

  const res = await getConnectUrl({ config }, platform, redirectUrl)
  return res.ok ? { ok: true, url: res.data.authUrl } : { ok: false, error: res.message }
}
