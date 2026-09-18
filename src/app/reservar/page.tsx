import { VirexMark } from "@/components/brand/virex-mark"
import { OperonBadge } from "@/components/brand/operon-badge"
import { BookingFlow } from "@/components/booking/booking-flow"
import { BRAND } from "@/config/brand"
import { db, now } from "@/lib/data/repo"
import { addDays, dayKey } from "@/lib/time"
import type { Appointment } from "@/lib/domain/types"

export const metadata = {
  title: "Reservá tu turno",
  description: `${BRAND.fullName} — ${BRAND.address}. Reservá online en un minuto.`,
  robots: { index: true, follow: true },
}

/**
 * Página pública de reservas (el link de la bio de Instagram).
 * TODO(producción): limitar pedidos por IP y validar el teléfono (código por
 * WhatsApp vía Zernio) antes de confirmar, para que nadie llene la agenda.
 */
export default async function ReservarPage() {
  const s = await db()
  const n = await now()
  const today = dayKey(n)
  const horizon = addDays(today, 15)

  // Sólo la ocupación: sin clientes, sin notas, sin precios cobrados.
  const busy: Appointment[] = s.appointments
    .filter((a) => {
      const d = dayKey(a.startsAt)
      return d >= today && d <= horizon && a.status !== "cancelado" && a.status !== "no_show"
    })
    .map((a) => ({
      id: "",
      clientId: "",
      staffId: a.staffId,
      serviceId: "",
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      status: a.status,
      source: "web",
      price: 0,
      notes: null,
      conversationId: null,
      createdAt: "",
    }))

  return (
    <div className="flex min-h-dvh flex-col bg-obsidian">
      <header className="bg-slats border-b border-line">
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 pt-10 pb-8 text-center">
          <VirexMark size={72} detail />
          <p className="mt-4 font-display text-gold-metal text-[30px] leading-none tracking-[0.06em]">VIREX</p>
          <p className="eyebrow mt-2 tracking-[0.34em]">Barbershop</p>
          <p className="mt-4 text-[14px] text-ivory-2">{BRAND.tagline} ✦</p>
          <p className="mt-1 text-[12.5px] text-ivory-3">
            {BRAND.address} · Mar a Sáb {BRAND.openingHours.open}–{BRAND.openingHours.close}
          </p>
        </div>
      </header>
      <main className="flex-1 pt-8">
        <BookingFlow services={s.services} staff={s.staff} busy={busy} now={n.toISOString()} />
      </main>
      <footer className="flex justify-center py-6">
        <OperonBadge />
      </footer>
    </div>
  )
}
