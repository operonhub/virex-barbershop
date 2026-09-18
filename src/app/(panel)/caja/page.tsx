import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { CajaView } from "@/components/caja/caja-view"
import { getCaja } from "@/lib/data/queries"
import { now } from "@/lib/data/repo"
import { addDays, dayKey, formatDayLong } from "@/lib/time"

export const metadata = { title: "Caja" }

export default async function CajaPage({ searchParams }: PageProps<"/caja">) {
  const params = await searchParams
  const today = dayKey(await now())
  const day = typeof params.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) && params.dia <= today ? params.dia : today
  const d = await getCaja(day)

  return (
    <PageBody>
      <PageHeader
        eyebrow={<span className="inline-block first-letter:uppercase">{formatDayLong(day)}</span>}
        title={d.isToday ? "Caja de hoy" : "Caja"}
        description="Lo que entró, por dónde entró y a quién le corresponde. El mes completo está en Finanzas."
        actions={
          <div className="flex items-center rounded-lg border border-line-strong">
            <Link href={`/caja?dia=${addDays(day, -1)}`} aria-label="Día anterior" className="grid size-10 place-items-center text-ivory-2 hover:text-ivory">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/caja" className="h-10 border-x border-line-strong px-3 text-[13px] leading-10 font-medium text-ivory">
              Hoy
            </Link>
            {d.isToday ? (
              <span className="grid size-10 place-items-center text-ivory-3/40">
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link href={`/caja?dia=${addDays(day, 1)}`} aria-label="Día siguiente" className="grid size-10 place-items-center text-ivory-2 hover:text-ivory">
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        }
      />
      <CajaView
        isToday={d.isToday}
        payments={d.payments}
        expenses={d.expenses}
        money={d.money}
        staffLines={d.staffLines}
        pending={d.pending}
        staff={d.staff}
        services={d.services}
        clients={d.clients}
        loyalty={d.loyalty}
      />
    </PageBody>
  )
}
