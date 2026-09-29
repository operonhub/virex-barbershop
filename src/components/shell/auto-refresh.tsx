"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Mantiene al día las pantallas que se dejan abiertas todo el día, sin que
 * nadie tenga que recargar: la Bandeja (llegan mensajes solos), Hoy, Agenda y
 * Caja (el agente agenda, alguien cobra desde otro dispositivo).
 *
 * `router.refresh()` vuelve a pedir los datos del servidor y conserva el
 * estado de la pantalla: lo que alguien está escribiendo no se pierde.
 *
 * Sólo consulta con la pestaña a la vista y con conexión: en segundo plano no
 * gasta ni base ni datos, y al volver a mirarla se pone al día enseguida.
 * Ajustes, Finanzas y Clientes no se refrescan: ahí se edita, y que la
 * pantalla cambie sola molesta más de lo que ayuda.
 */
const EVERY_MS: Record<string, number> = {
  "/bandeja": 6_000,
  "/": 20_000,
  "/agenda": 20_000,
  "/caja": 20_000,
}

export function AutoRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  const everyMs = EVERY_MS[pathname]

  useEffect(() => {
    if (!everyMs) return
    const tick = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh()
    }
    const id = setInterval(tick, everyMs)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [router, everyMs])

  return null
}
