import { CircleCheck, CircleAlert, Clock3 } from "lucide-react"
import { VirexMark } from "@/components/brand/virex-mark"
import { OperonBadge } from "@/components/brand/operon-badge"

export const metadata = { title: "Tu seña", robots: { index: false, follow: false } }

/**
 * Adonde vuelve el cliente después de pagar la seña en Mercado Pago.
 *
 * No consulta la base (es pública, sin login): sólo lee el estado que
 * Mercado Pago agrega a la URL al volver (`?status=approved|pending|rejected`).
 * Lo que de verdad confirma el turno es el webhook, no esta pantalla — así
 * que si el cliente cierra la ventana antes de llegar acá, no pasa nada.
 */
export default async function PagoPage({ searchParams }: PageProps<"/pago">) {
  const params = await searchParams
  const status = typeof params.status === "string" ? params.status : typeof params.collection_status === "string" ? params.collection_status : null

  const content =
    status === "approved" ? (
      <>
        <CircleCheck className="mx-auto mt-8 size-9 text-ok" />
        <h1 className="mt-3 font-display text-[24px] text-ivory">¡Turno confirmado!</h1>
        <p className="mt-2 text-[14px] text-ivory-2">Recibimos tu seña. Ya podés cerrar esta ventana — te esperamos.</p>
      </>
    ) : status === "pending" || status === "in_process" ? (
      <>
        <Clock3 className="mx-auto mt-8 size-9 text-ivory-2" />
        <h1 className="mt-3 font-display text-[24px] text-ivory">Estamos confirmando tu pago</h1>
        <p className="mt-2 text-[14px] text-ivory-2">Puede tardar unos minutos. Si no te llega la confirmación, escribinos.</p>
      </>
    ) : (
      <>
        <CircleAlert className="mx-auto mt-8 size-9 text-danger" />
        <h1 className="mt-3 font-display text-[24px] text-ivory">No se acreditó el pago</h1>
        <p className="mt-2 text-[14px] text-ivory-2">El horario se libera solo si no llega la seña a tiempo. Podés intentar de nuevo.</p>
      </>
    )

  return (
    <main className="flex min-h-dvh flex-col bg-obsidian bg-slats px-4">
      <div className="m-auto w-full max-w-[380px] py-12 text-center">
        <VirexMark size={52} className="mx-auto" />
        {content}
      </div>
      <OperonBadge className="mx-auto pb-6" />
    </main>
  )
}
