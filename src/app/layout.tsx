import type { Metadata, Viewport } from "next"
import { Archivo } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BRAND } from "@/config/brand"
import "./globals.css"

/**
 * Una sola familia: Archivo, con el eje de ancho (wdth 62–125) cargado.
 * Los títulos usan 125 % — la misma sans extendida del logo de Virex — y el
 * cuerpo 100 %. Ver las utilidades `font-display` / `font-wide` / `font-narrow`
 * en globals.css.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · Panel`, template: `%s · ${BRAND.name}` },
  description: `${BRAND.fullName} — agenda, bandeja, caja y agente IA.`,
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: "#0b0a09",
  colorScheme: "dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`dark ${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Síncrono a propósito: decide si corre la intro antes del primer
            pintado. Es un archivo de 600 bytes, propio y cacheado. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/intro-boot.js" />
      </head>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
