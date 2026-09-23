import Link from "next/link"
import { ArrowRight, Hand, Phone, Sparkles } from "lucide-react"
import { PageBody, PageHeader, Panel } from "@/components/shell/page-header"
import { DayTimeline } from "@/components/hoy/day-timeline"
import { AgentLiveCard } from "@/components/hoy/agent-live-card"
import { NewAppointmentButton } from "@/components/agenda/new-appointment-button"
import { StatusPill } from "@/components/agenda/status"
import { ChannelDot } from "@/components/brand/channel-icons"
import { buttonVariants } from "@/components/ui/button"
import { getHoy } from "@/lib/data/queries"
import { formatARS, formatNumber, pct } from "@/lib/money"
import { formatDayLong, hm, minutesOfDay, timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"

export const metadata = { title: "Hoy" }

/**
 * HOY — la pantalla que se abre a la mañana y queda abierta todo el día.
 *
 * Lectura en F: arriba a la izquierda lo que más importa (la plata del día),
 * a la derecha lo que está pasando solo (el agente), y abajo la lista de
 * cosas que necesitan a alguien. Una sola acción dorada: Nuevo turno.
 */
export default async function HoyPage() {
  const d = await getHoy()
  const now = new Date(d.now)
  const hour = minutesOfDay(d.now) / 60
  const greeting = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches"
  const left = d.activeCount - d.doneCount
  const clientOf = (id: string) => d.clients.find((c) => c.id === id)
  const serviceOf = (id: string) => d.services.find((s) => s.id === id)
  const staffOf = (id: string) => d.staff.find((s) => s.id === id)
  const upcoming = d.appointments
    .filter((a) => new Date(a.startsAt) > now && a.status !== "cancelado" && a.status !== "no_show")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6)
  const rewardIds = new Set(d.rewardsToday.map((r) => r.appointment.id))

  // Lo urgente: en escritorio va a la derecha; en el celular, arriba de todo.
  const needsHumanPanel =
    d.inbox.needsHuman.length > 0 ? (
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Hand className="size-4 text-danger" /> Esperan a una persona
          </span>
        }
        bodyClassName="px-0 pb-2"
        className="ring-1 ring-danger/25"
      >
        <ul>
          {d.inbox.needsHuman.map((c) => (
            <li key={c.id}>
              <Link href={`/bandeja?c=${c.id}`} className="flex items-start gap-3 px-5 py-2.5 hover:bg-surface-2">
                <ChannelDot channel={c.channel} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ivory">{c.participantName}</span>
                  <span className="block text-[12px] text-ivory-3">{c.handoffReason}</span>
                </span>
                <span className="num text-[11px] text-ivory-3">{timeAgo(c.lastMessageAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    ) : null

  return (
    <PageBody>
      <PageHeader
        eyebrow={formatDayLong(d.today)}
        title={`${greeting}, Santi`}
        description={
          d.open
            ? left > 0
              ? `Quedan ${left} turnos por atender. El agente agendó ${d.agent.booked} ${d.agent.booked === 1 ? "turno" : "turnos"} por su cuenta hoy.`
              : "No quedan turnos por atender hoy."
            : "Hoy el local está cerrado. El agente sigue respondiendo y agendando para la semana."
        }
        actions={
          <>
            <Link href="/agenda" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
              Ver agenda
            </Link>
            <NewAppointmentButton />
          </>
        }
      />

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* Plata del día: el número más grande de la pantalla, sin tarjetitas iguales. */}
          <section className="panel flex flex-col 2xl:flex-row">
            <div className="p-5 sm:p-6 2xl:flex-[1.35]">
              <p className="eyebrow">Caja de hoy</p>
              <p className="mt-2 flex items-baseline gap-1.5 text-ivory">
                <span className="font-wide text-[22px] text-ivory-2">$</span>
                <span className="num font-wide text-[44px] font-semibold leading-none tracking-tight">
                  {formatNumber(d.money.gross)}
                </span>
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, pct(d.money.services, d.expected))}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-ivory-3">
                <span className="num text-ivory-2">{formatARS(d.money.services)}</span> de{" "}
                <span className="num">{formatARS(d.expected)}</span> agendados
                {d.money.tips > 0 && (
                  <>
                    {" "}· <span className="num">{formatARS(d.money.tips)}</span> de propina
                  </>
                )}
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-line 2xl:flex-[3] 2xl:border-t-0">
              <Metric label="Atendidos" value={`${d.doneCount}`} unit={`/ ${d.activeCount}`} sub="turnos del día" />
              <Metric label="Ocupación" value={`${d.occupancy}`} unit="%" sub={`${d.staff.length} sillas`} />
              <Metric label="Ticket prom." value={formatNumber(d.money.avgTicket)} unit="$" unitFirst sub="por servicio" />
            </div>
          </section>

          <div className="xl:hidden">{needsHumanPanel}</div>

          <Panel
            title="La jornada"
            action={<span className="num text-[12px] text-ivory-3">{d.open ? `${hm(d.now)} · ahora` : "cerrado"}</span>}
          >
            <DayTimeline
              staff={d.staff}
              appointments={d.appointments}
              clients={d.clients}
              services={d.services}
              now={d.now}
              day={d.today}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Próximos"
              action={
                <Link href="/agenda" className="inline-flex items-center gap-1 text-[12px] text-ivory-3 hover:text-ivory">
                  Agenda <ArrowRight className="size-3" />
                </Link>
              }
              bodyClassName="px-0 pb-2"
            >
              {upcoming.length === 0 ? (
                <p className="px-5 pb-3 text-[13px] text-ivory-3">No quedan turnos hoy.</p>
              ) : (
                <ul>
                  {upcoming.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="num w-11 font-wide text-[14px] font-semibold text-ivory">{hm(a.startsAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 truncate text-[13.5px] font-medium text-ivory">
                          {clientOf(a.clientId)?.name}
                          {rewardIds.has(a.id) && (
                            <span className="inline-flex h-4.5 items-center gap-1 rounded-full bg-gold/12 px-1.5 text-[10.5px] font-semibold text-gold">
                              <Sparkles className="size-2.5" /> 50%
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[12px] text-ivory-3">
                          {serviceOf(a.serviceId)?.name} · {staffOf(a.staffId)?.name}
                        </span>
                      </span>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Volver a llamar" bodyClassName="px-0 pb-2">
              <p className="px-5 pb-2 text-[12.5px] text-ivory-3">
                Habituales que hace más de 5 semanas no vienen y no tienen turno.
              </p>
              <ul>
                {d.recontact.map(({ client, lastVisit, visits }) => (
                  <li key={client.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-ivory">{client.name}</span>
                      <span className="block text-[12px] text-ivory-3">
                        {visits} visitas · última {timeAgo(lastVisit, now)}
                      </span>
                    </span>
                    {client.phone && (
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`¡Hola ${client.name.split(" ")[0]}! Hace un tiempo que no te vemos por Virex 💈 ¿Te busco un turno esta semana?`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                      >
                        <Phone className="size-3.5" /> Escribirle
                      </a>
                    )}
                  </li>
                ))}
                {d.recontact.length === 0 && <li className="px-5 py-2 text-[13px] text-ivory-3">Nadie por ahora. 👌</li>}
              </ul>
            </Panel>
          </div>
        </div>

        <aside className="space-y-5">
          <AgentLiveCard
            enabled={d.agent.enabled}
            conversations={d.agent.conversations}
            booked={d.agent.booked}
            events={d.agent.events}
            now={d.now}
          />

          <div className="hidden xl:block">{needsHumanPanel}</div>

          {d.rewardsToday.length > 0 && (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-gold" /> Hoy les toca el 50%
                </span>
              }
              bodyClassName="px-0 pb-2"
            >
              <ul>
                {d.rewardsToday.map(({ appointment }) => (
                  <li key={appointment.id} className="flex items-center justify-between px-5 py-2 text-[13px]">
                    <span className="text-ivory">{clientOf(appointment.clientId)?.name}</span>
                    <span className="num text-ivory-3">{hm(appointment.startsAt)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </PageBody>
  )
}

function Metric({
  label,
  value,
  unit,
  unitFirst,
  sub,
}: {
  label: string
  value: string
  unit?: string
  unitFirst?: boolean
  sub: string
}) {
  return (
    <div className="min-w-0 border-line px-4 py-4 not-first:border-l sm:px-6 sm:py-5 2xl:border-l 2xl:py-6">
      <p className="eyebrow truncate max-sm:text-[10px] max-sm:tracking-[0.06em]">{label}</p>
      <p className="mt-2 flex items-baseline gap-1 text-ivory">
        {unitFirst && <span className="text-[15px] text-ivory-3">{unit}</span>}
        <span className="num font-wide text-[22px] font-semibold leading-none sm:text-[28px]">{value}</span>
        {!unitFirst && unit && <span className="text-[15px] text-ivory-3">{unit}</span>}
      </p>
      <p className="mt-2 text-[12px] text-ivory-3">{sub}</p>
    </div>
  )
}
