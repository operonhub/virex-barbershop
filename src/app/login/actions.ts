"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { PANEL_COOKIE, SESSION_DAYS, panelPassword, passwordMatches, sessionToken } from "@/lib/auth/session"

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = panelPassword()
  if (!password) return { error: "El panel todavía no tiene contraseña: falta configurar PANEL_PASSWORD en el servidor." }

  if (!passwordMatches(String(formData.get("password") ?? ""))) {
    // Frena un poco al que prueba contraseñas a lo bruto.
    await new Promise((r) => setTimeout(r, 700))
    return { error: "Contraseña incorrecta." }
  }

  const store = await cookies()
  store.set(PANEL_COOKIE, sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  })
  const next = String(formData.get("next") ?? "/")
  // Sólo rutas propias: nada de redirigir a otro sitio con ?next=//otro.com
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/")
}

export async function logout() {
  const store = await cookies()
  store.delete(PANEL_COOKIE)
  redirect("/login")
}
