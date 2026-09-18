"use client"

import { createContext, useContext, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Search, UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createAppointment } from "@/lib/data/actions"
import { freeSlots, isOpen } from "@/lib/domain/slots"
import { addDays, dayKey, formatDayShort, WEEKDAY_SHORT, weekday } from "@/lib/time"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Appointment, Client, Service, Staff } from "@/lib/domain/types"

/**
 * "Nuevo turno" es la acción más repetida del panel, así que vive en un solo
 * lugar y cualquier botón la abre (el + de mobile, la agenda, Hoy), con datos
 * precargados si vienen de un hueco de la agenda.
 *
 * Todo se elige con botones grandes, no con selects: se usa parado, con el
 * celular o la tablet en una mano, entre corte y corte.
 */

interface Prefill {
  day?: string
  time?: string
  staffId?: string
  clientId?: string
}

const Ctx = createContext<{ open: (prefill?: Prefill) => void }>({ open: () => {} })
export const useNewAppointment = () => useContext(Ctx)

export interface BookingCatalog {
  staff: Staff[]
  services: Service[]
  clients: Client[]
  /** Turnos de los próximos días, para calcular huecos sin ir al servidor. */
  appointments: Appointment[]
  now: string
}

export function NewAppointmentProvider({
  catalog,
  children,
}: {
  catalog: BookingCatalog
  children: React.ReactNode
}) {
  const [state, setState] = useState<{ open: boolean; prefill: Prefill; key: number }>({
    open: false,
    prefill: {},
    key: 0,
  })
  const api = useMemo(
    () => ({ open: (prefill: Prefill = {}) => setState((s) => ({ open: true, prefill, key: s.key + 1 })) }),
    []
  )
  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-[640px] scroll-thin">
          {/* `key` reinicia el formulario en cada apertura, con su precarga. */}
          <NewAppointmentForm
            key={state.key}
            catalog={catalog}
            prefill={state.prefill}
            onDone={() => setState((s) => ({ ...s, open: false }))}
          />
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

function NewAppointmentForm({
  catalog,
  prefill,
  onDone,
}: {
  catalog: BookingCatalog
  prefill: Prefill
  onDone: () => void
}) {
  const now = new Date(catalog.now)
  const today = dayKey(now)

  const days = nextOpenDays(today, 8)

  const [query, setQuery] = useState("")
  const [clientId, setClientId] = useState<string | null>(prefill.clientId ?? null)
  const [newPhone, setNewPhone] = useState("")
  const [serviceId, setServiceId] = useState(catalog.services[0].id)
  const [staffId, setStaffId] = useState(prefill.staffId ?? catalog.staff[0].id)
  const [day, setDay] = useState(prefill.day && isOpen(prefill.day) ? prefill.day : days[0])
  const [time, setTime] = useState<string | null>(prefill.time ?? null)
  const [pending, startTransition] = useTransition()

  const service = catalog.services.find((s) => s.id === serviceId)!
  const staff = catalog.staff.find((s) => s.id === staffId)!
  const client = catalog.clients.find((c) => c.id === clientId) ?? null

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return catalog.clients
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.instagram?.includes(q))
      .slice(0, 5)
  }, [query, catalog.clients])

  const slots = freeSlots({ day, service, staff, appointments: catalog.appointments, now, leadMin: 0 })
  // Si el horario elegido deja de estar libre al cambiar servicio o barbero,
  // se descarta en vez de mandar al servidor algo que va a rebotar.
  const chosen = time && slots.includes(time) ? time : null

  const canSubmit = (client || query.trim().length >= 2) && chosen && !pending

  function submit() {
    if (!chosen) return
    startTransition(async () => {
      const res = await createAppointment({
        day,
        time: chosen,
        staffId,
        serviceId,
        clientId: client?.id,
        newClient: client ? undefined : { name: query.trim(), phone: newPhone },
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Turno agendado · ${formatDayShort(day)} ${chosen} con ${staff.name}`)
      onDone()
    })
  }

  return (
    <div className="flex flex-col">
      <DialogHeader className="border-b border-line px-6 pt-6 pb-4">
        <DialogTitle className="font-display text-[20px]">Nuevo turno</DialogTitle>
        <DialogDescription className="text-ivory-3">Cliente, servicio, barbero y horario. Nada más.</DialogDescription>
      </DialogHeader>

      <div className="space-y-6 px-6 py-5">
        {/* Cliente */}
        <Field label="Cliente">
          {client ? (
            <div className="flex items-center justify-between rounded-lg border border-gold/40 bg-gold/8 px-3 py-2.5">
              <span>
                <span className="block text-[14px] font-medium text-ivory">{client.name}</span>
                <span className="num block text-[12px] text-ivory-3">{client.phone ?? `@${client.instagram}`}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => setClientId(null)}>
                Cambiar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ivory-3" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o @instagram"
                  className="h-11 w-full rounded-lg border border-line-strong bg-surface-2 pr-3 pl-9 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/60 focus:outline-none"
                />
              </div>
              {matches.length > 0 && (
                <ul className="overflow-hidden rounded-lg border border-line">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setClientId(c.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-2"
                      >
                        <span className="text-[14px] text-ivory">{c.name}</span>
                        <span className="num text-[12px] text-ivory-3">{c.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2">
                  <UserPlus className="size-4 shrink-0 text-ivory-3" />
                  <span className="text-[13px] text-ivory-2">
                    Nuevo: <b className="font-medium text-ivory">{query.trim()}</b>
                  </span>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Teléfono (opcional)"
                    inputMode="tel"
                    className="num ml-auto h-8 w-40 rounded-md border border-line bg-surface-2 px-2 text-[13px] text-ivory placeholder:text-ivory-3 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </Field>

        {/* Servicio */}
        <Field label="Servicio">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalog.services
              .filter((s) => s.active)
              .map((s) => (
                <Choice key={s.id} selected={s.id === serviceId} onClick={() => setServiceId(s.id)}>
                  <span className="block text-[13.5px] font-medium text-ivory">{s.name}</span>
                  <span className="num block text-[12px] text-ivory-3">
                    {formatARS(s.price)} · {s.durationMin} min
                  </span>
                </Choice>
              ))}
          </div>
        </Field>

        {/* Barbero */}
        <Field label="Barbero">
          <div className="flex flex-wrap gap-2">
            {catalog.staff.map((s) => {
              const cant = s.skipsServiceIds.includes(serviceId)
              return (
                <Choice
                  key={s.id}
                  selected={s.id === staffId}
                  disabled={cant}
                  onClick={() => setStaffId(s.id)}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-surface-3 text-[12px] font-semibold text-ivory">
                    {s.name[0]}
                  </span>
                  <span className="text-[13.5px] font-medium text-ivory">{s.name}</span>
                  {cant && <span className="text-[11px] text-ivory-3">no hace este servicio</span>}
                </Choice>
              )
            })}
          </div>
        </Field>

        {/* Día */}
        <Field label="Día">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scroll-thin">
            {days.map((d) => (
              <Choice key={d} selected={d === day} onClick={() => setDay(d)} className="min-w-[68px] px-2 py-2 text-center">
                <span className="block text-[11px] uppercase tracking-wide text-ivory-3">
                  {d === today ? "Hoy" : d === addDays(today, 1) ? "Mañana" : WEEKDAY_SHORT[weekday(d)]}
                </span>
                <span className="num block font-wide text-[17px] font-semibold text-ivory">{Number(d.slice(8))}</span>
              </Choice>
            ))}
          </div>
        </Field>

        {/* Horario */}
        <Field label={`Horarios libres de ${staff.name}`}>
          {slots.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-[13px] text-ivory-3">
              {staff.name} no tiene huecos para {service.name.toLowerCase()} ese día. Probá con otro barbero o día.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {slots.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={cn(
                    "num h-9 rounded-md border text-[13px] font-medium transition-colors",
                    t === chosen
                      ? "border-gold bg-gold text-obsidian"
                      : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong hover:text-ivory"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>

      <div className="sticky bottom-0 flex items-center gap-3 border-t border-line bg-popover/95 px-6 py-4 backdrop-blur">
        <p className="min-w-0 flex-1 truncate text-[13px] text-ivory-2">
          {chosen ? (
            <>
              <b className="font-medium text-ivory">{service.name}</b> · {formatDayShort(day)} {chosen} con {staff.name}{" "}
              · <span className="num">{formatARS(service.price)}</span>
            </>
          ) : (
            "Elegí un horario"
          )}
        </p>
        <Button size="lg" disabled={!canSubmit} onClick={submit} className="h-10 px-5 font-semibold">
          <Check /> Agendar
        </Button>
      </div>
    </div>
  )
}

function nextOpenDays(from: string, count: number) {
  const out: string[] = []
  for (let d = from; out.length < count; d = addDays(d, 1)) if (isOpen(d)) out.push(d)
  return out
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow mb-2">{label}</h3>
      {children}
    </section>
  )
}

function Choice({
  selected,
  disabled,
  onClick,
  className,
  children,
}: {
  selected: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border-2 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-gold bg-gold/8" : "border-line bg-surface-2 hover:border-line-strong",
        className
      )}
    >
      {children}
    </button>
  )
}
