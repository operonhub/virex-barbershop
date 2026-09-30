"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TimeSelect } from "@/components/forms/time-select"
import { BRAND } from "@/config/brand"
import { quickAppointment } from "@/lib/data/actions"
import { formatARS } from "@/lib/money"
import { hm, hmToMinutes, minutesToHm } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { Client, Service, Staff } from "@/lib/domain/types"

const SHOP_OPEN = hmToMinutes(BRAND.openingHours.open)
const SHOP_CLOSE = hmToMinutes(BRAND.openingHours.close)

/** La próxima hora de 5 en 5 desde ahora, dentro del horario del local. */
function nextFiveMinutes() {
  const [h, m] = hm(new Date()).split(":").map(Number)
  const t = Math.ceil((h * 60 + m) / 5) * 5
  return minutesToHm(Math.min(Math.max(t, SHOP_OPEN), SHOP_CLOSE - 5))
}

/** Duraciones para elegir: las comunes, más la del servicio si es otra. */
const durationChoices = (serviceMin: number) => [...new Set([30, 45, 60, 90, serviceMin])].sort((a, b) => a - b)

/**
 * Turno rápido: alguien cae de golpe. Nombre y corte, y listo: por defecto
 * arranca ya (o cuando termine el turno del barbero) y se cobra después desde
 * Caja. Si hace falta, se elige cuánto dura (un corte de 30', de 45') o a qué
 * hora es hoy ("a las 17:15"), para no dejar huecos en la agenda. Es un botón
 * secundario a propósito: el dorado de Hoy es de "Nuevo turno".
 */
export function QuickAppointmentButton({ staff, services, clients }: { staff: Staff[]; services: Service[]; clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const activeStaff = staff.filter((s) => s.active)
  const activeServices = services.filter((s) => s.active)
  const [name, setName] = useState("")
  const [client, setClient] = useState<Client | null>(null)
  const [staffId, setStaffId] = useState(activeStaff[0]?.id ?? "")
  const [serviceId, setServiceId] = useState(activeServices[0]?.id ?? "")
  const [durationOverride, setDurationOverride] = useState<number | null>(null)
  const [atTime, setAtTime] = useState<string | null>(null) // null = ahora
  const [pending, startTransition] = useTransition()

  const service = activeServices.find((s) => s.id === serviceId)
  const duration = durationOverride ?? service?.durationMin ?? 60

  // Si ya vino alguna vez, se elige de la lista: no se duplica el cliente ni se pierde su tarjeta.
  const matches = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (client || q.length < 2) return []
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4)
  }, [name, client, clients])

  function reset() {
    setName("")
    setClient(null)
    setDurationOverride(null)
    setAtTime(null)
  }

  function submit() {
    startTransition(async () => {
      const res = await quickAppointment({ staffId, serviceId, clientId: client?.id, name, durationMin: duration, ...(atTime ? { time: atTime } : {}) })
      if (!res.ok) return void toast.error(res.error)
      const { waitMin, startsAt, staffName } = res.data!
      const who = client?.name ?? name.trim()
      toast.success(
        atTime
          ? `Anotado: ${who} con ${staffName} de ${hm(startsAt)} a ${minutesToHm(hmToMinutes(hm(startsAt)) + duration)}`
          : waitMin === 0
            ? `Anotado: ${who} con ${staffName}, ya en curso`
            : `Anotado: ${who} con ${staffName} a las ${hm(startsAt)}, cuando termine el turno que tiene`
      )
      setOpen(false)
      reset()
    })
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-lg border text-[13px] font-medium transition-colors",
      active ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
    )

  return (
    <>
      <Button size="lg" variant="outline" className="h-10 px-4 font-semibold" onClick={() => setOpen(true)}>
        <Zap /> Turno rápido
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) reset()
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-[20px]">Turno rápido</DialogTitle>
            <DialogDescription className="text-ivory-3">Para el que cae sin avisar. Por defecto arranca ya y se cobra después desde Caja.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12.5px] text-ivory-2" htmlFor="quick-name">
                Nombre
              </label>
              <input
                id="quick-name"
                autoFocus
                value={client ? client.name : name}
                onChange={(e) => {
                  setClient(null)
                  setName(e.target.value)
                }}
                placeholder="¿Cómo se llama?"
                className="h-11 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none"
              />
              {matches.length > 0 && (
                <ul className="mt-1.5 divide-y divide-line rounded-lg border border-line">
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setClient(c)} className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-2">
                        <span className="text-[13.5px] text-ivory">{c.name}</span>
                        <span className="text-[11.5px] text-ivory-3">ya es cliente</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <section>
              <h3 className="eyebrow mb-2">Corte</h3>
              <div className="grid grid-cols-2 gap-2">
                {activeServices.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setServiceId(s.id)
                      setDurationOverride(null)
                    }}
                    aria-pressed={serviceId === s.id}
                    className={cn(chip(serviceId === s.id), "flex h-12 flex-col items-center justify-center")}
                  >
                    {s.name}
                    <span className="num text-[11px] font-normal text-ivory-3">{formatARS(s.price)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Lo atiende</h3>
              <div className="grid grid-cols-3 gap-2">
                {activeStaff.map((s) => (
                  <button key={s.id} type="button" onClick={() => setStaffId(s.id)} aria-pressed={staffId === s.id} className={cn(chip(staffId === s.id), "h-10")}>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Cuánto dura</h3>
              <div className="flex flex-wrap gap-1.5">
                {durationChoices(service?.durationMin ?? 60).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={m === duration}
                    onClick={() => setDurationOverride(m === service?.durationMin ? null : m)}
                    className={cn(chip(m === duration), "num h-9 px-3")}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Cuándo</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={atTime === null} onClick={() => setAtTime(null)} className={cn(chip(atTime === null), "h-10 px-4")}>
                  Ahora
                </button>
                <button type="button" aria-pressed={atTime !== null} onClick={() => setAtTime(atTime ?? nextFiveMinutes())} className={cn(chip(atTime !== null), "h-10 px-4")}>
                  A una hora
                </button>
                {atTime !== null && <TimeSelect value={atTime} onChange={setAtTime} label="Hora de hoy" to={minutesToHm(SHOP_CLOSE - 5)} className="h-10" />}
              </div>
              <p className="mt-1.5 text-[12px] text-ivory-3">
                {atTime === null ? "Si el barbero está con alguien, queda a continuación." : `Hoy, de ${atTime} a ${minutesToHm(hmToMinutes(atTime) + duration)}.`}
              </p>
            </section>

            <Button size="lg" className="h-11 w-full text-[15px] font-semibold" disabled={pending || !staffId || !serviceId || (!client && name.trim().length < 2)} onClick={submit}>
              {pending ? "Anotando…" : "Anotar turno"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
