import { CircleCheck, CircleAlert } from "lucide-react"
import { VirexMark } from "@/components/brand/virex-mark"
import { OperonBadge } from "@/components/brand/operon-badge"

export const metadata = { title: "Conexión", robots: { index: false, follow: false } }

/**
 * Adonde vuelve el dueño después de conectar su WhatsApp o su Instagram con
 * el link de Zernio. Pública (él no tiene la contraseña del panel) y sin datos
 * sensibles: sólo le dice si salió bien.
 */
export default async function ConectadoPage({ searchParams }: PageProps<"/conectado">) {
  const params = await searchParams
  const canal = params.canal === "instagram" ? "Instagram" : "WhatsApp"
  const error = typeof params.error === "string" ? params.error : null
  const detail = typeof params.error_message === "string" ? params.error_message.slice(0, 200) : null

  return (
    <main className="flex min-h-dvh flex-col bg-obsidian bg-slats px-4">
      <div className="m-auto w-full max-w-[380px] py-12 text-center">
        <VirexMark size={52} className="mx-auto" />
        {error ? (
          <>
            <CircleAlert className="mx-auto mt-8 size-9 text-danger" />
            <h1 className="mt-3 font-display text-[24px] text-ivory">No se pudo conectar</h1>
            <p className="mt-2 text-[14px] text-ivory-2">
              El {canal} no quedó conectado{detail ? `: ${detail}` : "."} Avisale a quien te mandó el link y lo intentan de nuevo.
            </p>
          </>
        ) : (
          <>
            <CircleCheck className="mx-auto mt-8 size-9 text-ok" />
            <h1 className="mt-3 font-display text-[24px] text-ivory">¡Listo!</h1>
            <p className="mt-2 text-[14px] text-ivory-2">
              El {canal} de Virex quedó conectado. Ya podés cerrar esta ventana: seguís usando la app como siempre.
            </p>
          </>
        )}
      </div>
      <OperonBadge className="mx-auto pb-6" />
    </main>
  )
}
