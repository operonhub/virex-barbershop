"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarPlus, Phone, Search, StickyNote } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button, buttonVariants } from "@/components/ui/button"
import { ChannelDot } from "@/components/brand/channel-icons"
import { useNewAppointment } from "@/components/agenda/new-appointment"
import { formatARS } from "@/lib/money"
import { dayKey, formatDayShort, hm, timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import { LoyaltyCard, LoyaltyStamps } from "./loyalty-card"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Appointment, Client, Service, Staff } from "@/lib/domain/types"

type Segment = "nuevo" | "frecuente" | "en_riesgo" | "ocasional"

export interface ClientRow {
  client: Client
  visits: number
  noShows: number
  spent: number
  avgTicket: number
  lastVisit: string | null
  next: Appointment | null
  daysSince: number | null
  segment: Segment
  loyalty: LoyaltyStatus
  history: Appointment[]
}

const SEGMENTS: { id: Segment | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "frecuente", label: "Frecuentes" },
  { id: "en_riesgo", label: "En riesgo" },
  { id: "nuevo", label: "Nuevos" },
]

const SEGMENT_LABEL: Record<Segment, string> = {
  nuevo: "Nuevo",
  frecuente: "Frecuente",
  en_riesgo: "En riesgo",
  ocasional: "Ocasional",
}

const PAGE = 40

export function ClientsView({
  rows,
  now,
  services,
  staff,
}: {
  rows: ClientRow[]
  now: string
  services: Service[]
  staff: Staff[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [query, setQuery] = useState("")
  const [segment, setSegment] = useState<Segment | "todos">("todos")
  const [limit, setLimit] = useState(PAGE)
  const openId = params.get("c")
  const open = rows.find((r) => r.client.id === openId) ?? null
  const n = new Date(now)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (segment === "todos" || r.segment === segment) &&
        (!q || r.client.name.toLowerCase().includes(q) || r.client.phone?.includes(q) || r.client.instagram?.includes(q))
    )
  }, [rows, query, segment])

  const setOpen = (id: string | null) => router.replace(id ? `/clientes?c=${id}` : "/clientes", { scroll: false })

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ivory-3" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Buscar por nombre, teléfono o @instagram"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface-1 pr-3 pl-9 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/60 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-1 p-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSegment(s.id)
                setLimit(PAGE)
              }}
              aria-pressed={segment === s.id}
              className={cn(
                "h-8 rounded-md px-3 text-[12.5px] font-medium transition-colors",
                segment === s.id ? "bg-surface-3 text-ivory" : "text-ivory-3 hover:text-ivory-2"
              )}
            >
              {s.label}
              <span className="num ml-1.5 text-[11px] text-ivory-3">
                {s.id === "todos" ? rows.length : rows.filter((r) => r.segment === s.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel mt-4 overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,2fr)_90px_120px_110px_150px_minmax(0,1.2fr)] gap-4 border-b border-line px-5 py-2.5 text-[11px] font-semibold tracking-[0.12em] text-ivory-3 uppercase lg:grid">
          <span>Cliente</span>
          <span className="text-right">Visitas</span>
          <span>Última</span>
          <span className="text-right">Ticket</span>
          <span>Fidelidad</span>
          <span>Próximo turno</span>
        </div>
        <ul>
          {filtered.slice(0, limit).map((r) => (
            <li key={r.client.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => setOpen(r.client.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition-colors hover:bg-surface-2 lg:grid-cols-[minmax(0,2fr)_90px_120px_110px_150px_minmax(0,1.2fr)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="relative shrink-0">
                    <span className="grid size-9 place-items-center rounded-full bg-surface-3 font-wide text-[13px] font-semibold text-ivory">
                      {r.client.name[0]}
                    </span>
                    {r.client.channel && <ChannelDot channel={r.client.channel} className="absolute -right-0.5 -bottom-0.5 size-3.5 [&_svg]:size-2" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-ivory">{r.client.name}</span>
                    <span className="flex items-center gap-2 text-[12px] text-ivory-3">
                      <span
                        className={cn(
                          r.segment === "en_riesgo" && "text-danger",
                          r.segment === "frecuente" && "text-ivory-2"
                        )}
                      >
                        {SEGMENT_LABEL[r.segment]}
                      </span>
                      <span className="num hidden sm:inline">{r.client.phone}</span>
                    </span>
                  </span>
                </span>
                <span className="num text-right text-[13.5px] text-ivory lg:block">
                  {r.visits}
                  <span className="text-ivory-3 lg:hidden"> visitas</span>
                </span>
                <span className="hidden text-[13px] text-ivory-2 lg:block">{r.lastVisit ? timeAgo(r.lastVisit, n) : "—"}</span>
                <span className="num hidden text-right text-[13px] text-ivory-2 lg:block">{r.avgTicket ? formatARS(r.avgTicket) : "—"}</span>
                <span className="hidden lg:block">
                  <LoyaltyStamps status={r.loyalty} />
                </span>
                <span className="hidden truncate text-[13px] text-ivory-2 lg:block">
                  {r.next ? (
                    <>
                      {formatDayShort(dayKey(r.next.startsAt))} · <span className="num">{hm(r.next.startsAt)}</span>
                    </>
                  ) : (
                    <span className="text-ivory-3">—</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {filtered.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full border-t border-line py-3 text-[13px] font-medium text-ivory-2 hover:bg-surface-2 hover:text-ivory"
          >
            Mostrar más ({filtered.length - limit} restantes)
          </button>
        )}
        {filtered.length === 0 && <p className="px-5 py-10 text-center text-[13px] text-ivory-3">No hay clientes con ese filtro.</p>}
      </div>

      <ClientSheet row={open} now={n} services={services} staff={staff} onClose={() => setOpen(null)} />
    </>
  )
}

function ClientSheet({
  row,
  now,
  services,
  staff,
  onClose,
}: {
  row: ClientRow | null
  now: Date
  services: Service[]
  staff: Staff[]
  onClose: () => void
}) {
  const { open } = useNewAppointment()
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-line scroll-thin sm:max-w-[480px]">
        {row && (
          <>
            <SheetHeader className="px-6 pt-6">
              <SheetTitle className="font-display text-[24px] leading-tight">{row.client.name}</SheetTitle>
              <SheetDescription className="num text-ivory-3">
                {row.client.phone}
                {row.client.instagram && ` · @${row.client.instagram}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-6 pb-8">
              <LoyaltyCard status={row.loyalty} clientName={row.client.name.split(" ")[0]} />

              <dl className="grid grid-cols-3 gap-3">
                <Stat label="Visitas" value={String(row.visits)} />
                <Stat label="Gastado" value={formatARS(row.spent)} />
                <Stat label="No vino" value={String(row.noShows)} />
              </dl>

              <div className="flex gap-2">
                <Button className="h-10 flex-1 font-semibold" onClick={() => open({ clientId: row.client.id })}>
                  <CalendarPlus /> Agendar
                </Button>
                {row.client.phone && (
                  <a
                    href={`https://wa.me/${row.client.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-1.5 px-4")}
                  >
                    <Phone className="size-4" /> WhatsApp
                  </a>
                )}
              </div>

              {row.client.cutNotes && (
                <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <p className="eyebrow mb-1 flex items-center gap-1.5">
                    <StickyNote className="size-3" /> Cómo se corta
                  </p>
                  <p className="text-[14px] text-ivory">{row.client.cutNotes}</p>
                </div>
              )}

              <section>
                <h3 className="eyebrow mb-2">Últimas visitas</h3>
                {row.history.length === 0 ? (
                  <p className="text-[13px] text-ivory-3">Todavía no vino.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {row.history.map((a) => (
                      <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                        <span>
                          <span className="block text-ivory">{services.find((s) => s.id === a.serviceId)?.name}</span>
                          <span className="block text-[12px] text-ivory-3">
                            con {staff.find((s) => s.id === a.staffId)?.name} · {timeAgo(a.startsAt, now)}
                          </span>
                        </span>
                        <span className="num text-ivory-2">{formatARS(a.price)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 px-3 py-2.5">
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className="num mt-1 font-wide text-[16px] font-semibold text-ivory">{value}</dd>
    </div>
  )
}
