import { NextResponse, type NextRequest } from "next/server"
import { isValidSession, PANEL_COOKIE } from "@/lib/auth/session"

/**
 * Portero del panel: sin sesión, cualquier página lleva a /login.
 *
 * Quedan afuera (públicos): la reserva online, el webhook de Zernio (/api),
 * la pantalla de login y los archivos estáticos. Las server actions además
 * chequean la sesión por su cuenta (`assertPanelSession`).
 */
export function proxy(request: NextRequest) {
  if (isValidSession(request.cookies.get(PANEL_COOKIE)?.value)) return NextResponse.next()

  // Un POST sin sesión (server action) no se redirige: se rechaza.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("No autorizado", { status: 401 })
  }
  const login = new URL("/login", request.url)
  const next = request.nextUrl.pathname + request.nextUrl.search
  if (next !== "/") login.searchParams.set("next", next)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|login|reservar|api/|icon.svg|favicon.ico|intro-boot.js).*)"],
}
