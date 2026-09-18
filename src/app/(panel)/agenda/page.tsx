import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { DayGrid } from "@/components/agenda/day-grid"
import { NewAppointmentButton } from "@/components/agenda/new-appointment-button"
import { buttonVariants } from "@/components/ui/button"
import { getAgenda } from "@/lib/data/queries"
import { now } from "@/lib/data/repo"
import { addDays, dayKey, formatDayLong, WEEKDAY_SHORT, weekday } from "@/lib/time"
import { cn } from "@/lib/utils"

export const metadata = { title: "Agenda" }

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const params = await searchParams
  const today = dayKey(await now())
  const requested = typeof params.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : today
  const d = await getAgenda(requested)
  const isToday = d.day === d.today

  return (
    <PageBody>
      <PageHeader
        eyebrow={isToday ? "Hoy" : d.day < d.today ? "Día pasado" : "Próximamente"}
        title={<span className="inline-block first-letter:uppercase">{formatDayLong(d.day)}</span>}
        actions={
          <>
            <div className="flex items-center rounded-lg border border-line-strong">
              <Link
                href={`/agenda?dia=${addDays(d.day, -1)}`}
                aria-label="Día anterior"
                className="grid size-10 place-items-center text-ivory-2 hover:text-ivory"
              >
                <ChevronLeft className="size-4" />
              </Link>
              <Link
                href="/agenda"
                className={cn("h-10 border-x border-line-strong px-3 text-[13px] font-medium leading-10", isToday ? "text-ivory-3" : "text-ivory")}
              >
                Hoy
              </Link>
              <Link
                href={`/agenda?dia=${addDays(d.day, 1)}`}
                aria-label="Día siguiente"
                className="grid size-10 place-items-center text-ivory-2 hover:text-ivory"
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <NewAppointmentButton day={d.day} />
          </>
        }
      />

      {/* Semana: cuántos turnos hay cada día, para ver de un vistazo dónde hay lugar. */}
      <nav aria-label="Semana" className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {d.week.map((w) => {
          const active = w.day === d.day
          return (
            <Link
              key={w.day}
              href={`/agenda?dia=${w.day}`}
              aria-current={active ? "date" : undefined}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition-colors sm:px-3",
                active ? "border-gold/60 bg-gold/8" : "border-line bg-surface-1 hover:border-line-strong",
                !w.open && "opacity-45"
              )}
            >
              <span className="block text-[11px] font-medium tracking-wide text-ivory-3 uppercase">
                {w.day === d.today ? "Hoy" : WEEKDAY_SHORT[weekday(w.day)]}
              </span>
              <span className="num block font-wide text-[18px] font-semibold text-ivory">{Number(w.day.slice(8))}</span>
              {w.open ? (
                <>
                  <span className="mx-auto mt-1.5 block h-1 w-full max-w-12 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-ivory-2" style={{ width: `${Math.min(100, w.occupancy)}%` }} />
                  </span>
                  <span className="num mt-1 hidden text-[11px] text-ivory-3 sm:block">{w.count} turnos</span>
                </>
              ) : (
                <span className="mt-1.5 block text-[11px] text-ivory-3">Cerrado</span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-5">
        {d.open ? (
          <DayGrid
            day={d.day}
            isToday={isToday}
            now={d.now}
            staff={d.staff}
            services={d.services}
            clients={d.clients}
            appointments={d.appointments}
            paidIds={d.paidAppointmentIds}
            loyalty={d.loyalty}
          />
        ) : (
          <div className="panel grid place-items-center px-6 py-16 text-center">
            <p className="font-display text-[20px] text-ivory">Cerrado</p>
            <p className="mt-2 max-w-sm text-[14px] text-ivory-2">
              Virex atiende de martes a sábado de 11 a 20. El agente igual responde y agenda para los días hábiles.
            </p>
            <Link href={`/agenda?dia=${addDays(d.day, 1)}`} className={cn(buttonVariants({ variant: "outline" }), "mt-5")}>
              Ver el día siguiente
            </Link>
          </div>
        )}
      </div>
    </PageBody>
  )
}
