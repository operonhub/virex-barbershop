"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Bot, Footprints, MessageCircle, Phone, Scissors, Sparkles, StickyNote } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { BRAND } from "@/config/brand"
import { setAppointmentStatus } from "@/lib/data/actions"
import { formatARS } from "@/lib/money"
import { dayKey, formatDayShort, hm, hmToMinutes, minutesOfDay, minutesToHm } from "@/lib/time"
import { cn } from "@/lib/utils"
import { useNewAppointment } from "./new-appointment"
import { SOURCE_LABEL, StatusPill } from "./status"
import { ChargeDialog } from "@/components/caja/charge-dialog"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Appointment, AppointmentStatus, Client, Service, Staff } from "@/lib/domain/types"

const PX_PER_MIN = 1.25

/**
 * Agenda del día: una columna por silla. Tocar un hueco abre "Nuevo turno"
 * con barbero y hora ya puestos; tocar un turno abre su ficha con las
 * acciones que tocan según el estado (confirmar → empezar → cobrar).
 */
export function DayGrid({
  day,
  isToday,
  now,
  staff,
  services,
  clients,
  appointments,
  paidIds,
  loyalty,
}: {
  day: string
  isToday: boolean
  now: string
  staff: Staff[]
  services: Service[]
  clients: Client[]
  appointments: Appointment[]
  paidIds: string[]
  loyalty: Record<string, LoyaltyStatus>
}) {
  const { open: openNew } = useNewAppointment()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chargingId, setChargingId] = useState<string | null>(null)

  const openMin = hmToMinutes(BRAND.openingHours.open)
  const closeMin = hmToMinutes(BRAND.openingHours.close)
  const height = (closeMin - openMin) * PX_PER_MIN
  const hours = Array.from({ length: (closeMin - openMin) / 60 + 1 }, (_, i) => openMin + i * 60)
  const nowMin = minutesOfDay(now)
  const paid = new Set(paidIds)

  const serviceOf = (id: string) => services.find((s) => s.id === id)!
  const clientOf = (id: string) => clients.find((c) => c.id === id)
  const selected = appointments.find((a) => a.id === selectedId) ?? null
  const charging = appointments.find((a) => a.id === chargingId) ?? null

  // Links desde Hoy llegan con #idDelTurno: se abre su ficha directamente.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && appointments.some((a) => a.id === id)) {
      const t = window.setTimeout(() => setSelectedId(id), 0)
      return () => window.clearTimeout(t)
    }
  }, [appointments])

  function clickEmpty(staffId: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const minutes = openMin + Math.floor((e.clientY - rect.top) / PX_PER_MIN / 15) * 15
    openNew({ day, staffId, time: minutesToHm(Math.min(minutes, closeMin - 15)) })
  }

  return (
    <>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[620px]">
            {/* Encabezados de silla */}
            <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(0,1fr))` }}>
              <div />
              {staff.map((s) => {
                const mine = appointments.filter((a) => a.staffId === s.id && a.status !== "cancelado" && a.status !== "no_show")
                return (
                  <div key={s.id} className="flex items-center gap-2.5 border-l border-line px-4 py-3">
                    <span className="grid size-8 place-items-center rounded-full bg-surface-3 font-wide text-[13px] font-semibold text-ivory">
                      {s.name[0]}
                    </span>
                    <span className="leading-tight">
                      <span className="block text-[14px] font-medium text-ivory">{s.name}</span>
                      <span className="num block text-[11.5px] text-ivory-3">
                        {mine.length} turnos · {formatARS(mine.reduce((sum, a) => sum + a.price, 0))}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Grilla */}
            <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(0,1fr))`, height }}>
              <div className="relative">
                {hours.map((m) => (
                  <span
                    key={m}
                    className="num absolute right-2 -translate-y-1/2 text-[11px] text-ivory-3"
                    style={{ top: (m - openMin) * PX_PER_MIN }}
                  >
                    {minutesToHm(m)}
                  </span>
                ))}
              </div>

              {staff.map((s) => (
                <div
                  key={s.id}
                  onClick={(e) => clickEmpty(s.id, e)}
                  className="group/col relative cursor-copy border-l border-line"
                  title={`Agendar con ${s.name}`}
                >
                  {hours.slice(1, -1).map((m) => (
                    <span key={m} aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: (m - openMin) * PX_PER_MIN }} />
                  ))}
                  {hours.slice(0, -1).map((m) => (
                    <span
                      key={`h${m}`}
                      aria-hidden
                      className="absolute inset-x-0 h-px bg-line/40"
                      style={{ top: (m + 30 - openMin) * PX_PER_MIN }}
                    />
                  ))}

                  {appointments
                    .filter((a) => a.staffId === s.id)
                    .map((a) => {
                      const start = minutesOfDay(a.startsAt)
                      const end = minutesOfDay(a.endsAt)
                      const service = serviceOf(a.serviceId)
                      const client = clientOf(a.clientId)
                      const reward = loyalty[a.clientId]?.rewardReady && service.countsForLoyalty && !paid.has(a.id)
                      const short = (end - start) * PX_PER_MIN < 38
                      return (
                        <button
                          key={a.id}
                          id={a.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedId(a.id)
                          }}
                          className={cn(
                            "absolute inset-x-1.5 overflow-hidden rounded-lg px-2.5 text-left transition-[background-color,transform] hover:z-10 hover:-translate-y-px",
                            short ? "flex items-center py-0" : "py-1.5",
                            // Mismo código que "La jornada": contorno completo según el estado.
                            a.status === "completado" && "bg-surface-2 opacity-60 ring-1 ring-line ring-inset hover:opacity-100",
                            a.status === "en_curso" && "bg-ok/12 ring-1 ring-ok/60 ring-inset",
                            a.status === "confirmado" && "bg-surface-3 ring-1 ring-line-strong ring-inset hover:bg-[#2c2924]",
                            a.status === "pendiente" && "bg-surface-2 outline-1 -outline-offset-1 outline-dashed outline-ivory-3/60",
                            (a.status === "cancelado" || a.status === "no_show") && "bg-danger/8 line-through opacity-55 ring-1 ring-danger/50 ring-inset"
                          )}
                          style={{ top: (start - openMin) * PX_PER_MIN + 1, height: (end - start) * PX_PER_MIN - 2 }}
                        >
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="num shrink-0 text-[11px] text-ivory-3">{hm(a.startsAt)}</span>
                            <span className="truncate text-[13px] font-medium text-ivory">{client?.name}</span>
                          </span>
                          {!short && (
                            <span className="flex items-center gap-1.5 text-[11.5px] text-ivory-3">
                              <span className="truncate">{service.name}</span>
                              {a.source === "agente" && <Bot className="size-3 shrink-0" aria-label="Lo agendó el agente" />}
                              {reward && <Sparkles className="size-3 shrink-0 text-gold" aria-label="Le toca el 50%" />}
                            </span>
                          )}
                        </button>
                      )
                    })}
                </div>
              ))}

              {isToday && nowMin > openMin && nowMin < closeMin && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-0 left-[50px] z-20 flex items-center"
                  style={{ top: (nowMin - openMin) * PX_PER_MIN }}
                >
                  <span className="size-[7px] rounded-full bg-gold shadow-[0_0_10px_2px_rgb(214_179_106/0.5)]" />
                  <span className="h-px flex-1 bg-gold" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AppointmentSheet
        appointment={selected}
        service={selected ? serviceOf(selected.serviceId) : undefined}
        client={selected ? clientOf(selected.clientId) : undefined}
        staff={selected ? staff.find((s) => s.id === selected.staffId) : undefined}
        loyalty={selected ? loyalty[selected.clientId] : undefined}
        paid={selected ? paid.has(selected.id) : false}
        onClose={() => setSelectedId(null)}
        onCharge={(id) => {
          setSelectedId(null)
          setChargingId(id)
        }}
      />

      {charging && (
        <ChargeDialog
          key={charging.id}
          open
          onOpenChange={(o) => !o && setChargingId(null)}
          appointment={charging}
          client={clientOf(charging.clientId)}
          service={serviceOf(charging.serviceId)}
          staff={staff.find((s) => s.id === charging.staffId)}
          loyalty={loyalty[charging.clientId]}
        />
      )}
    </>
  )
}

function AppointmentSheet({
  appointment: a,
  service,
  client,
  staff,
  loyalty,
  paid,
  onClose,
  onCharge,
}: {
  appointment: Appointment | null
  service: Service | undefined
  client: Client | undefined
  staff: Staff | undefined
  loyalty: LoyaltyStatus | undefined
  paid: boolean
  onClose: () => void
  onCharge: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()

  function move(status: AppointmentStatus, message: string) {
    if (!a) return
    startTransition(async () => {
      const res = await setAppointmentStatus(a.id, status)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success(message)
        onClose()
      }
    })
  }

  return (
    <Sheet open={!!a} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full border-line sm:max-w-[420px]">
        {a && service && (
          <>
            <SheetHeader className="border-b border-line px-6 pt-6 pb-5">
              <div className="flex items-center gap-2">
                <StatusPill status={a.status} />
                {paid && <span className="text-[11px] font-medium text-ok">Cobrado</span>}
              </div>
              <SheetTitle className="font-display text-[22px] leading-tight">{client?.name}</SheetTitle>
              <SheetDescription className="text-ivory-2">
                {service.name} · {formatDayShort(dayKey(a.startsAt))} ·{" "}
                <span className="num">
                  {hm(a.startsAt)}–{hm(a.endsAt)}
                </span>{" "}
                con {staff?.name}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 scroll-thin">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Info label="Precio" value={<span className="num">{formatARS(a.price)}</span>} />
                <Info
                  label="Origen"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {a.source === "agente" ? <Bot className="size-3.5" /> : a.source === "walk_in" ? <Footprints className="size-3.5" /> : <Scissors className="size-3.5" />}
                      {SOURCE_LABEL[a.source]}
                    </span>
                  }
                />
                {client?.phone && <Info label="Teléfono" value={<span className="num">{client.phone}</span>} />}
                {loyalty && (
                  <Info
                    label="Fidelidad"
                    value={
                      loyalty.rewardReady ? (
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Sparkles className="size-3.5" /> Le toca el 50%
                        </span>
                      ) : (
                        <span className="num">
                          {loyalty.stamps} de {loyalty.required} sellos
                        </span>
                      )
                    }
                  />
                )}
              </dl>

              {client?.cutNotes && (
                <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <p className="eyebrow mb-1 flex items-center gap-1.5">
                    <StickyNote className="size-3" /> Cómo se corta
                  </p>
                  <p className="text-[13.5px] text-ivory">{client.cutNotes}</p>
                </div>
              )}
              {a.notes && <p className="text-[13px] text-ivory-2">{a.notes}</p>}

              <div className="flex flex-wrap gap-2">
                {client?.phone && (
                  <a
                    href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
                  >
                    <Phone className="size-3.5" /> WhatsApp
                  </a>
                )}
                {a.conversationId && (
                  <Link href={`/bandeja?c=${a.conversationId}`} className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
                    <MessageCircle className="size-3.5" /> Ver chat
                  </Link>
                )}
              </div>
            </div>

            {/* Acciones según el estado: una principal (dorada) y las demás discretas. */}
            <div className="space-y-2 border-t border-line px-6 py-4">
              {a.status === "pendiente" && (
                <Button size="lg" className="h-11 w-full font-semibold" disabled={pending} onClick={() => move("confirmado", "Turno confirmado")}>
                  Confirmar turno
                </Button>
              )}
              {a.status === "confirmado" && (
                <Button size="lg" className="h-11 w-full font-semibold" disabled={pending} onClick={() => move("en_curso", "Arrancó el turno")}>
                  <Scissors /> Empezar
                </Button>
              )}
              {(a.status === "en_curso" || (a.status === "completado" && !paid)) && (
                <Button size="lg" className="h-11 w-full font-semibold" disabled={pending} onClick={() => onCharge(a.id)}>
                  Cobrar
                </Button>
              )}
              {["pendiente", "confirmado"].includes(a.status) && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={pending} onClick={() => move("no_show", "Marcado como no vino")}>
                    No vino
                  </Button>
                  <Button variant="destructive" disabled={pending} onClick={() => move("cancelado", "Turno cancelado")}>
                    Cancelar turno
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-0.5 text-[10px]">{label}</dt>
      <dd className="text-ivory">{value}</dd>
    </div>
  )
}
