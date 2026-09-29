import "server-only"
import { listAccounts } from "./client"
import { readZernioConfig } from "./config"
import { ownAccountIds } from "./scope"

/**
 * ¿Esta cuenta de Zernio es de este panel? Se usa en las dos puertas:
 * el webhook (no guardar mensajes de otro negocio) y el envío (no mandar
 * nunca desde una cuenta ajena).
 *
 * Falla CERRADO: sin `ZERNIO_PROFILE_ID`, o si Zernio no responde, dice que
 * no. Mejor perder un mensaje (que el reintento de Zernio recupera) que
 * mezclar dos negocios. Fuera de producción sin profile deja pasar, para poder
 * probar en local.
 */

const TTL_MS = 5 * 60_000
/** Una cuenta recién conectada no está en la caché: se refresca, pero no más de una vez por acá. */
const MIN_REFRESH_MS = 30_000

let cache: { ids: Set<string>; at: number } | null = null

async function refresh(profileId: string): Promise<Set<string> | null> {
  const config = readZernioConfig()
  if (!config.configured) return null
  const res = await listAccounts({ config })
  if (!res.ok) return null
  cache = { ids: ownAccountIds(res.data.accounts, profileId), at: Date.now() }
  return cache.ids
}

export async function isOwnAccount(accountId: string): Promise<boolean> {
  const config = readZernioConfig()
  if (!config.configured) return process.env.NODE_ENV !== "production"
  if (!config.profileId) return process.env.NODE_ENV !== "production"
  if (!accountId) return false

  const fresh = cache && Date.now() - cache.at < TTL_MS
  if (fresh && cache!.ids.has(accountId)) return true
  // No está (o la caché venció): una consulta a Zernio, acotada.
  if (cache && Date.now() - cache.at < MIN_REFRESH_MS) return false
  const ids = await refresh(config.profileId)
  return !!ids?.has(accountId)
}
