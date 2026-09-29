import "server-only"
import { cookies } from "next/headers"
import { isValidSession, PANEL_COOKIE } from "./session"

/**
 * Para usar al principio de CADA server action del panel. El proxy ya frena
 * las páginas, pero una server action se puede llamar por POST desde otra
 * ruta (la documentación de Next 16 lo advierte): el chequeo va en las dos.
 */
export async function assertPanelSession() {
  const store = await cookies()
  if (!isValidSession(store.get(PANEL_COOKIE)?.value)) throw new Error("No autorizado: iniciá sesión en el panel.")
}
