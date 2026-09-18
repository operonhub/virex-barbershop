"use client"

import Link from "next/link"
import { BRAND } from "@/config/brand"
import { hm, hmToMinutes, minutesOfDay } from "@/lib/time"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { STATUS_LABEL } from "@/components/agenda/status"
import type { Appointment, Client, Service, Staff } from "@/lib/domain/types"

/**
 * "La jornada": un carril por barbero, de la apertura al cierre, con la línea
 * dorada del ahora. De un vistazo se ve quién está libre, quién viene
 * atrasado y cuánto falta para cerrar — lo que en el local hoy se pregunta a
 * los gritos.
 */
export function DayTimeline({
  staff,
  appointments,
  clients,
  services,
  now,
  day,
}: {
  staff: Staff[]
  appointments: Appointment[]
  clients: Client[]
  services: Service[]
  now: string
  day: string
}) {
  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)
  const span = close - open
  const pos = (m: number) => `${((m - open) / span) * 100}%`
  const nowMin = minutesOfDay(now)
  const showNow = nowMin >= open && nowMin <= close
  const hours = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => open + i * 60)

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Cliente"
  const serviceOf = (id: string) => services.find((s) => s.id === id)

  return (
    <div className="-mx-5 overflow-x-auto px-5 scroll-thin">
      <div className="relative min-w-[680px]">
        {/* Horas */}
        <div className="relative ml-[76px] h-6">
          {hours.map((m) => (
            <span
              key={m}
              className="num absolute -translate-x-1/2 text-[11px] text-ivory-3"
              style={{ left: pos(m) }}
            >
              {m / 60}
            </span>
          ))}
        </div>

        <div className="relative space-y-2">
          {staff.map((member) => {
            const mine = appointments.filter(
              (a) => a.staffId === member.id && a.status !== "cancelado"
            )
            const busyNow = mine.find(
              (a) => minutesOfDay(a.startsAt) <= nowMin && minutesOfDay(a.endsAt) > nowMin
            )
            return (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <p className="text-[13px] font-medium text-ivory">{member.name}</p>
                  <p className={cn("text-[11px]", busyNow ? "text-ok" : "text-ivory-3")}>
                    {showNow ? (busyNow ? "atendiendo" : "libre") : " "}
                  </p>
                </div>
                <div className="relative h-11 flex-1 rounded-lg bg-surface-2/60">
                  {hours.slice(1, -1).map((m) => (
                    <span key={m} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: pos(m) }} />
                  ))}
                  {mine.map((a) => {
                    const s = minutesOfDay(a.startsAt)
                    const e = minutesOfDay(a.endsAt)
                    const svc = serviceOf(a.serviceId)
                    return (
                      <Tooltip key={a.id}>
                        <TooltipTrigger
                          render={
                            <Link
                              href={`/agenda?dia=${day}#${a.id}`}
                              aria-label={`${hm(a.startsAt)} ${clientName(a.clientId)} — ${svc?.name}`}
                              className={cn(
                                // Estado por contorno completo, no por un borde lateral: lleno = confirmado,
                                // punteado = sin confirmar, verde = en curso, rojo = no vino.
                                "absolute inset-y-1 overflow-hidden rounded-md px-2 py-1 transition-colors",
                                a.status === "completado" && "bg-surface-3/50 opacity-60 ring-1 ring-line ring-inset hover:opacity-100",
                                a.status === "en_curso" && "bg-ok/12 ring-1 ring-ok/60 ring-inset",
                                a.status === "confirmado" && "bg-surface-3 ring-1 ring-line-strong ring-inset hover:bg-[#2c2924]",
                                a.status === "pendiente" && "bg-surface-3/60 outline-1 -outline-offset-1 outline-dashed outline-ivory-3/60",
                                a.status === "no_show" && "bg-danger/10 opacity-70 ring-1 ring-danger/50 ring-inset"
                              )}
                              style={{ left: pos(s), width: `calc(${((e - s) / span) * 100}% - 2px)` }}
                            />
                          }
                        >
                          <span className="block truncate text-[11.5px] font-medium leading-tight text-ivory">
                            {clientName(a.clientId).split(" ")[0]}
                          </span>
                          <span className="block truncate text-[10.5px] leading-tight text-ivory-3">{svc?.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="num">
                            {hm(a.startsAt)}–{hm(a.endsAt)}
                          </span>{" "}
                          · {clientName(a.clientId)} · {svc?.name} · {STATUS_LABEL[a.status]}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {showNow && (
            <div
              aria-hidden
              className="pointer-events-none absolute -top-1 -bottom-1 ml-[76px]"
              style={{ left: `calc((100% - 76px) * ${(nowMin - open) / span})` }}
            >
              <div className="absolute inset-y-0 w-px bg-gold" style={{ animation: "now-line 3s ease-in-out infinite" }} />
              <div className="absolute -top-1.5 -left-[3px] size-[7px] rounded-full bg-gold shadow-[0_0_10px_2px_rgb(214_179_106/0.5)]" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
