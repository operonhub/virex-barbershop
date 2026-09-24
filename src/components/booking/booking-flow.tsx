"use client"

import { useMemo, useState, useTransition } from "react"
import { ArrowLeft, Check, Clock3, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WhatsAppIcon } from "@/components/brand/channel-icons"
import { createPublicBooking } from "@/lib/data/actions"
import { freeSlots, freeSlotsAnyStaff, isOpen } from "@/lib/domain/slots"
import { addDays, dayKey, formatDayLong, WEEKDAY_SHORT, weekday } from "@/lib/time"
import { formatARS } from "@/lib/money"
import { BRAND } from "@/config/brand"
import { cn } from "@/lib/utils"
import type { Appointment, Service, Staff } from "@/lib/domain/types"

type Step = "servicio" | "horario" | "datos" | "listo"

/**
 * Reserva online para clientes. Tres pasos, un pulgar: servicio → horario →
 * datos. Recibe sólo la ocupación (horarios tomados), nunca quién los tomó.
 */
export function BookingFlow({
  services,
  staff,
  busy,
  now,
}: {
  services: Service[]
  staff: Staff[]
  busy: Appointment[]
  now: string
}) {
  const today = dayKey(now)
  const days = useMemo(() => {
    const out: string[] = []
    let d = today
    while (out.length < 10) {
      if (isOpen(d)) out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [today])

  const [step, setStep] = useState<Step>("servicio")
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState<string>("cualquiera")
  const [day, setDay] = useState(days[0])
  const [slot, setSlot] = useState<{ time: string; staffId: string } | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const service = services.find((s) => s.id === serviceId)
  const available = staff.filter((s) => s.active && (!service || !s.skipsServiceIds.includes(service.id)))

  const slots = useMemo(() => {
    if (!service) return []
    const base = { day, service, appointments: busy, now: new Date(now) }
    if (staffId === "cualquiera") return freeSlotsAnyStaff({ ...base, staff: available })
    const m = available.find((s) => s.id === staffId)
    return m ? freeSlots({ ...base, staff: m }).map((time) => ({ time, staffId: m.id })) : []
  }, [service, day, staffId, busy, now, available])

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name

  function confirm() {
    if (!service || !slot) return
    setError(null)
    startTransition(async () => {
      const res = await createPublicBooking({ day, time: slot.time, staffId: slot.staffId, serviceId: service.id, name, phone })
      if (!res.ok) setError(res.error)
      else setStep("listo")
    })
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-10">
      {step !== "servicio" && step !== "listo" && (
        <button
          type="button"
          onClick={() => setStep(step === "datos" ? "horario" : "servicio")}
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ivory-2 hover:text-ivory"
        >
          <ArrowLeft className="size-4" /> Volver
        </button>
      )}

      {step === "servicio" && (
        <section>
          <h2 className="font-display text-[22px] text-ivory">¿Qué te hacés?</h2>
          <ul className="mt-4 space-y-2">
            {services
              .filter((s) => s.active)
              .map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setServiceId(s.id)
                      setSlot(null)
                      setStep("horario")
                    }}
                    className="flex w-full items-center justify-between rounded-xl border-2 border-line bg-surface-1 px-4 py-3.5 text-left transition-colors hover:border-gold/50"
                  >
                    <span>
                      <span className="block text-[15px] font-semibold text-ivory">{s.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ivory-3">
                        <Clock3 className="size-3" /> {s.durationMin} min
                      </span>
                    </span>
                    <span className="num text-[15px] font-medium text-ivory">{formatARS(s.price)}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {step === "horario" && service && (
        <section className="space-y-6">
          <h2 className="font-display text-[22px] text-ivory">{service.name}</h2>

          <div>
            <p className="eyebrow mb-2">Con quién</p>
            <div className="flex flex-wrap gap-2">
              {[{ id: "cualquiera", name: "El primero libre" }, ...available].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setStaffId(m.id)
                    setSlot(null)
                  }}
                  aria-pressed={staffId === m.id}
                  className={cn(
                    "h-10 rounded-full border-2 px-4 text-[13.5px] font-medium",
                    staffId === m.id ? "border-gold bg-gold/10 text-ivory" : "border-line bg-surface-1 text-ivory-2"
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Día</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scroll-thin">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDay(d)
                    setSlot(null)
                  }}
                  aria-pressed={day === d}
                  className={cn(
                    "min-w-[64px] rounded-xl border-2 py-2 text-center",
                    day === d ? "border-gold bg-gold/10" : "border-line bg-surface-1"
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-wide text-ivory-3">
                    {d === today ? "Hoy" : d === addDays(today, 1) ? "Mañana" : WEEKDAY_SHORT[weekday(d)]}
                  </span>
                  <span className="num block font-wide text-[18px] font-semibold text-ivory">{Number(d.slice(8))}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Horario</p>
            {slots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-[13.5px] text-ivory-3">
                No quedan horarios ese día. Probá con otro día o con otro barbero.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    onClick={() => {
                      setSlot(s)
                      setStep("datos")
                    }}
                    className="num h-11 rounded-lg border border-line bg-surface-1 text-[14px] font-medium text-ivory-2 transition-colors hover:border-gold/60 hover:text-ivory"
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {step === "datos" && service && slot && (
        <section className="space-y-5">
          <h2 className="font-display text-[22px] text-ivory">Tus datos</h2>
          <p className="rounded-xl border border-gold/30 bg-gold/8 px-4 py-3 text-[14px] text-ivory">
            {service.name} · <span className="first-letter:uppercase">{formatDayLong(day)}</span> ·{" "}
            <span className="num">{slot.time}</span> con {staffName(slot.staffId)}
          </p>
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellido"
              autoComplete="name"
              className="h-12 w-full rounded-xl border border-line-strong bg-surface-1 px-4 text-[15px] text-ivory placeholder:text-ivory-3 focus:border-gold/60 focus:outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp (para recordarte el turno)"
              inputMode="tel"
              autoComplete="tel"
              className="num h-12 w-full rounded-xl border border-line-strong bg-surface-1 px-4 text-[15px] text-ivory placeholder:text-ivory-3 focus:border-gold/60 focus:outline-none"
            />
          </div>
          {error && <p className="text-[13.5px] text-danger">{error}</p>}
          <Button
            size="lg"
            className="h-12 w-full text-[15px] font-semibold"
            disabled={name.trim().length < 3 || phone.replace(/\D/g, "").length < 8 || pending}
            onClick={confirm}
          >
            Confirmar turno
          </Button>
        </section>
      )}

      {step === "listo" && service && slot && (
        <section className="pt-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-gold text-obsidian">
            <Check className="size-7" strokeWidth={2.5} />
          </span>
          <h2 className="mt-5 font-display text-[24px] text-ivory">¡Te esperamos!</h2>
          <p className="mt-2 text-[15px] text-ivory-2">
            {service.name}, <span className="first-letter:uppercase">{formatDayLong(day)}</span> a las{" "}
            <span className="num">{slot.time}</span> con {staffName(slot.staffId)}.
          </p>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-ivory-3">
            <MapPin className="size-3.5" /> {BRAND.address}
          </p>
          <a
            href={BRAND.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-[14px] text-ivory-2 hover:text-ivory"
          >
            <WhatsAppIcon className="size-4" /> ¿Dudas? Escribinos
          </a>
        </section>
      )}
    </div>
  )
}
