import { createHash, createHmac, timingSafeEqual } from "node:crypto"

/**
 * Login simple del panel: UNA contraseña para todo el equipo (PANEL_PASSWORD),
 * hasta que llegue el login con usuarios de Supabase (Fase 2 del roadmap).
 *
 * La cookie no guarda la contraseña: guarda una firma derivada de ella. Si se
 * cambia PANEL_PASSWORD en Railway, todas las sesiones abiertas se invalidan
 * solas (sirve para "echar a todos" si la contraseña se filtró).
 *
 * Sin dependencias de Next a propósito: lo usan el proxy y las server actions.
 */

export const PANEL_COOKIE = "virex_panel"
export const SESSION_DAYS = 30

export const panelPassword = () => process.env.PANEL_PASSWORD?.trim() || null

export function sessionToken(password: string) {
  return createHmac("sha256", password).update("virex-panel-v1").digest("hex")
}

/**
 * ¿Esta cookie abre el panel? En desarrollo, sin contraseña configurada, el
 * panel queda abierto (comodidad). En producción, sin contraseña, queda
 * CERRADO: olvidarse de configurarla no puede dejar el panel expuesto.
 */
export function isValidSession(cookie: string | undefined): boolean {
  const password = panelPassword()
  if (!password) return process.env.NODE_ENV !== "production"
  return !!cookie && safeEqual(cookie, sessionToken(password))
}

export function passwordMatches(input: string): boolean {
  const password = panelPassword()
  return !!password && safeEqual(input, password)
}

/** Comparación en tiempo constante (sobre hashes, para que el largo no importe). */
function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}
