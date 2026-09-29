import type { ZernioAccount } from "./types"

/**
 * Qué cuentas de Zernio son de ESTE panel.
 *
 * Una API key de Zernio ve todas las cuentas del usuario, de todos los
 * "profiles". Si un webhook queda sin filtro (o el usuario tiene otros
 * negocios conectados), llegan mensajes de otro negocio: ya pasó una vez con
 * el WhatsApp de Operon apareciendo en la Bandeja de la barbería, y una
 * respuesta del agente habría salido desde el número equivocado.
 *
 * Módulo **puro**, sin red ni entorno, para probarlo con Vitest.
 */

/** Ids de las cuentas que pertenecen al profile de este panel. */
export function ownAccountIds(accounts: ZernioAccount[], profileId: string): Set<string> {
  return new Set(accounts.filter((a) => a.zernioProfileId === profileId).map((a) => a.zernioAccountId))
}
