"use client"

import { useState, useTransition } from "react"
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { BRAND } from "@/config/brand"
import { addTimeOff, removeTimeOff, saveSchedule, saveStaff } from "@/lib/data/settings-actions"
import { dayKey, formatDayShort, hm, WEEKDAY_SHORT } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { Staff, TimeOffEntry, WorkShift } from "@/lib/domain/types"
import { Choice, Toggle } from "./services-editor"

/** Días que abre el local, empezando por el martes (no por el domingo). */
const OPEN_DAYS = [...BRAND.openingHours.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
const open = Number(BRAND.openingHours.open.slice(0, 2))
const close = Number(BRAND.openingHours.close.slice(0, 2))
const HOURS = Array.from({ length: close - open + 1 }, (_, i) => `${String(open + i).padStart(2, "0")}:00`)
const DEFAULT_SHIFT = { start: BRAND.openingHours.open, end: BRAND.openingHours.close }

/**
 * El equipo: datos, horario semanal y francos de cada uno. Todo lo que se
 * guarda acá lo respeta el cálculo de horarios libres (`freeSlots`), así que
 * el agente, la reserva web y el panel dejan de ofrecer a quien no está.
 */
export function TeamEditor({ staff, timeOff, today }: { staff: Staff[]; timeOff: TimeOffEntry[]; today: string }) {
  const [editing, setEditing] = useState<Partial<Staff> | null>(null)
  const [offFor, setOffFor] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      {staff.map((m) => (
        <section key={m.id} className={cn("panel", !m.active && "opacity-60")}>
          <header className="flex items-center gap-3 px-5 pt-4 pb-3">
            <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-[13px] font-semibold text-ivory">{m.name[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ivory">
                {m.name}
                {!m.active && <span className="ml-2 text-[11.5px] font-normal text-ivory-3">(dado de baja)</span>}
              </span>
              <span className="block text-[12px] text-ivory-3">
                {m.role === "dueno" ? "Dueño" : `Barbero · ${m.commissionPct}% de comisión + propinas`}
              </span>
            </span>
            <Button variant="ghost" size="icon" aria-label={`Editar ${m.name}`} onClick={() => setEditing(m)}>
              <Pencil />
            </Button>
          </header>
          <div className="space-y-4 px-5 pb-5">
            {/* La key resetea el borrador cuando llega el horario guardado desde el servidor. */}
            <ScheduleEditor key={JSON.stringify(m.schedule ?? null)} member={m} />
            <TimeOffList entries={timeOff.filter((t) => t.staffId === m.id)} onAdd={() => setOffFor(m.id)} />
          </div>
        </section>
      ))}
      <Button variant="outline" className="h-10 w-full" onClick={() => setEditing({ name: "", commissionPct: 50, active: true })}>
        <Plus /> Sumar a alguien al equipo
      </Button>
      {editing && <StaffDialog member={editing} onClose={() => setEditing(null)} />}
      {offFor && <TimeOffDialog member={staff.find((m) => m.id === offFor)!} today={today} onClose={() => setOffFor(null)} />}
    </div>
  )
}

/* ── Horario semanal ── */

type Row = { works: boolean; start: string; end: string }

function toRows(member: Staff): Record<number, Row> {
  return Object.fromEntries(
    OPEN_DAYS.map((wd) => {
      // Sin horario propio (demo): trabaja todo el horario del local.
      if (!member.schedule) return [wd, { works: true, ...DEFAULT_SHIFT }]
      const shift = member.schedule.find((s) => s.weekday === wd)
      return [wd, shift ? { works: true, start: shift.start, end: shift.end } : { works: false, ...DEFAULT_SHIFT }]
    })
  )
}

function ScheduleEditor({ member }: { member: Staff }) {
  const initial = JSON.stringify(toRows(member))
  const [rows, setRows] = useState(() => toRows(member))
  const [pending, startTransition] = useTransition()
  const dirty = JSON.stringify(rows) !== initial
  const set = (wd: number, patch: Partial<Row>) => setRows((cur) => ({ ...cur, [wd]: { ...cur[wd], ...patch } }))

  function save() {
    const shifts: WorkShift[] = OPEN_DAYS.filter((wd) => rows[wd].works).map((wd) => ({ weekday: wd, start: rows[wd].start, end: rows[wd].end }))
    startTransition(async () => {
      const res = await saveSchedule(member.id, shifts)
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Horario de ${member.name} guardado`)
    })
  }

  return (
    <div>
      <p className="eyebrow mb-2 text-[10px]">Horario de la semana</p>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {OPEN_DAYS.map((wd) => {
          const r = rows[wd]
          return (
            <li key={wd} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
              <span className="w-9 text-[13px] font-medium text-ivory">{WEEKDAY_SHORT[wd]}</span>
              <Switch className="data-checked:bg-ivory-2" checked={r.works} onCheckedChange={(v) => set(wd, { works: v })} aria-label={`${member.name} trabaja el ${WEEKDAY_SHORT[wd]}`} />
              {r.works ? (
                <span className="flex items-center gap-1.5 text-[13px] text-ivory-3">
                  <HourSelect value={r.start} onChange={(v) => set(wd, { start: v })} label="Entra" />
                  a
                  <HourSelect value={r.end} onChange={(v) => set(wd, { end: v })} label="Sale" />
                </span>
              ) : (
                <span className="text-[13px] text-ivory-3">No trabaja</span>
              )}
            </li>
          )
        })}
      </ul>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar horario"}
          </Button>
        </div>
      )}
    </div>
  )
}

function HourSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="num h-8 rounded-md border border-line-strong bg-surface-2 px-1.5 text-[13px] text-ivory"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}

/* ── Francos ── */

function describeOff(t: TimeOffEntry) {
  const from = new Date(t.startsAt)
  const to = new Date(t.endsAt)
  const fullDays = hm(from) === "00:00" && hm(to) === "00:00"
  if (fullDays) {
    const last = dayKey(new Date(to.getTime() - 60_000))
    const first = dayKey(from)
    return first === last ? formatDayShort(first) : `${formatDayShort(first)} al ${formatDayShort(last)}`
  }
  return `${formatDayShort(dayKey(from))}, ${hm(from)} a ${hm(to)}`
}

function TimeOffList({ entries, onAdd }: { entries: TimeOffEntry[]; onAdd: () => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow text-[10px]">Francos y vacaciones</p>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <CalendarOff /> Agregar
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-[12.5px] text-ivory-3">Ninguno cargado.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <span className="min-w-0 flex-1 text-[13px] text-ivory">
                {describeOff(t)}
                {t.reason && <span className="text-ivory-3"> · {t.reason}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar franco"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeTimeOff(t.id)
                    if (res.ok) toast.success("Franco quitado")
                    else toast.error(res.error)
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const REASONS = ["Franco", "Vacaciones", "Médico", "Trámite"]

function TimeOffDialog({ member, today, onClose }: { member: Staff; today: string; onClose: () => void }) {
  const [fullDay, setFullDay] = useState(true)
  const [fromDay, setFromDay] = useState(today)
  const [toDay, setToDay] = useState(today)
  const [fromTime, setFromTime] = useState("11:00")
  const [toTime, setToTime] = useState("14:00")
  const [reason, setReason] = useState("Franco")
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await addTimeOff({
        staffId: member.id,
        fromDay,
        toDay: fullDay ? toDay : fromDay,
        ...(fullDay ? {} : { fromTime, toTime }),
        reason,
      })
      if (!res.ok) return void toast.error(res.error)
      if (res.overlapping) {
        toast.warning(`Guardado. Ojo: ${member.name} ya tiene ${res.overlapping} turno${res.overlapping === 1 ? "" : "s"} en ese lapso. Movelos desde la agenda.`)
      } else toast.success("Franco guardado")
      onClose()
    })
  }

  const dateClass =
    "num h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory [color-scheme:dark] focus:border-gold/50 focus:outline-none"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">Franco de {member.name}</DialogTitle>
          <DialogDescription className="text-ivory-3">En esos días el agente y la reserva web no lo ofrecen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5">
            <Choice active={fullDay} onClick={() => setFullDay(true)}>
              Días completos
            </Choice>
            <Choice active={!fullDay} onClick={() => setFullDay(false)}>
              Unas horas
            </Choice>
          </div>
          {fullDay ? (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1.5 block text-[12.5px] text-ivory-2">Desde</span>
                <input type="date" value={fromDay} min={today} onChange={(e) => { setFromDay(e.target.value); if (e.target.value > toDay) setToDay(e.target.value) }} className={dateClass} />
              </label>
              <label>
                <span className="mb-1.5 block text-[12.5px] text-ivory-2">Hasta (inclusive)</span>
                <input type="date" value={toDay} min={fromDay} onChange={(e) => setToDay(e.target.value)} className={dateClass} />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] text-ivory-2">Día</span>
                <input type="date" value={fromDay} min={today} onChange={(e) => setFromDay(e.target.value)} className={dateClass} />
              </label>
              <div className="flex items-center gap-2 text-[13px] text-ivory-3">
                De <HourSelect value={fromTime} onChange={setFromTime} label="Desde" /> a <HourSelect value={toTime} onChange={setToTime} label="Hasta" />
              </div>
            </div>
          )}
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] text-ivory-2">Motivo (sólo lo ve el equipo)</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {REASONS.map((r) => (
                <Choice key={r} active={reason === r} onClick={() => setReason(r)}>
                  {r}
                </Choice>
              ))}
            </div>
          </fieldset>
          <Button size="lg" className="h-10 w-full font-semibold" disabled={pending} onClick={submit}>
            {pending ? "Guardando…" : "Guardar franco"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Datos del barbero ── */

function StaffDialog({ member, onClose }: { member: Partial<Staff>; onClose: () => void }) {
  const [name, setName] = useState(member.name ?? "")
  const [commission, setCommission] = useState(String(member.commissionPct ?? 50))
  const [active, setActive] = useState(member.active ?? true)
  const [pending, startTransition] = useTransition()
  const owner = member.role === "dueno"

  function submit() {
    startTransition(async () => {
      const res = await saveStaff({ id: member.id, name, commissionPct: owner ? 0 : Number(commission), active })
      if (!res.ok) return void toast.error(res.error)
      toast.success(member.id ? "Datos guardados" : `${name.trim()} ya está en el equipo`)
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">{member.id ? `Editar a ${member.name}` : "Sumar al equipo"}</DialogTitle>
          <DialogDescription className="text-ivory-3">
            {member.id ? "La comisión se usa en la liquidación de la caja." : "Arranca con el horario del local; después lo ajustás."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-ivory-2">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory focus:border-gold/50 focus:outline-none"
            />
          </label>
          {!owner && (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] text-ivory-2">Comisión sobre cada servicio</span>
              <span className="relative block">
                <input
                  value={commission}
                  onChange={(e) => setCommission(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  inputMode="numeric"
                  className="num h-10 w-full rounded-lg border border-line-strong bg-surface-2 pr-8 pl-3 text-[14px] text-ivory focus:border-gold/50 focus:outline-none"
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] text-ivory-3">%</span>
              </span>
            </label>
          )}
          {member.id && !owner && <Toggle label="Atiende (si lo apagás, deja de aparecer para agendar)" checked={active} onChange={setActive} />}
          <Button size="lg" className="h-10 w-full font-semibold" disabled={pending} onClick={submit}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
