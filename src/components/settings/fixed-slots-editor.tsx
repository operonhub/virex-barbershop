"use client"

import { useState, useTransition } from "react"
import { Pencil, Pin, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { BRAND } from "@/config/brand"
import { removeFixedSlot, saveFixedSlot } from "@/lib/data/settings-actions"
import { formatDayShort, WEEKDAY_SHORT } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { FixedSlot, Staff } from "@/lib/domain/types"
import { Choice } from "./services-editor"

/** Días que abre el local, empezando por el martes (no por el domingo). */
const OPEN_DAYS = [...BRAND.openingHours.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
const open = Number(BRAND.openingHours.open.slice(0, 2))
const close = Number(BRAND.openingHours.close.slice(0, 2))
const HOURS = Array.from({ length: close - open + 1 }, (_, i) => `${String(open + i).padStart(2, "0")}:00`)
const dayOrder = (wd: number) => (wd + 6) % 7

function sortSlots(a: FixedSlot, b: FixedSlot) {
  // Semanales primero (por día de la semana), después los de un día (por fecha).
  if ((a.weekday === null) !== (b.weekday === null)) return a.weekday === null ? 1 : -1
  if (a.weekday !== null && b.weekday !== null && a.weekday !== b.weekday) return dayOrder(a.weekday) - dayOrder(b.weekday)
  if (a.onDate && b.onDate && a.onDate !== b.onDate) return a.onDate.localeCompare(b.onDate)
  return a.start.localeCompare(b.start)
}

/**
 * Turnos fijos: horarios que quedan reservados para alguien (todas las
 * semanas, o un día puntual). El agente y la reserva web no los ofrecen, así
 * que no hace falta cargarlos como excepción en las reglas del agente.
 */
export function FixedSlotsEditor({ staff, slots, today }: { staff: Staff[]; slots: FixedSlot[]; today: string }) {
  const [editing, setEditing] = useState<Partial<FixedSlot> | null>(null)
  const active = staff.filter((m) => m.active)

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ivory-3">
        Para los clientes que vienen siempre el mismo día y hora. Ese horario deja de ofrecerse a los demás, por WhatsApp, Instagram y en la reserva web. Cuando el
        cliente llega, se anota con <b className="font-medium text-ivory-2">Turno rápido</b>.
      </p>

      {active.map((m) => {
        const mine = slots.filter((s) => s.staffId === m.id).sort(sortSlots)
        return (
          <section key={m.id} className="panel">
            <header className="flex items-center gap-3 px-5 pt-4 pb-3">
              <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-[13px] font-semibold text-ivory">{m.name[0]}</span>
              <span className="min-w-0 flex-1 text-[14px] font-medium text-ivory">{m.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditing({ staffId: m.id, weekday: OPEN_DAYS[0], onDate: null, start: "18:00", end: "19:00", active: true })}>
                <Plus /> Agregar
              </Button>
            </header>
            <div className="px-5 pb-5">
              {mine.length === 0 ? (
                <p className="text-[12.5px] text-ivory-3">Sin turnos fijos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {mine.map((s) => (
                    <SlotRow key={s.id} slot={s} onEdit={() => setEditing(s)} />
                  ))}
                </ul>
              )}
            </div>
          </section>
        )
      })}

      {editing && <SlotDialog slot={editing} staff={active} today={today} onClose={() => setEditing(null)} />}
    </div>
  )
}

function SlotRow({ slot, onEdit }: { slot: FixedSlot; onEdit: () => void }) {
  const [pending, startTransition] = useTransition()
  const when = slot.weekday !== null ? `${WEEKDAY_SHORT[slot.weekday]}, todas las semanas` : `${formatDayShort(slot.onDate!)}, una sola vez`

  return (
    <li className={cn("flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2", !slot.active && "opacity-60")}>
      <Pin className="size-3.5 shrink-0 text-ivory-3" />
      <span className="min-w-0 flex-1 text-[13px] text-ivory">
        <span className="num font-medium">
          {slot.start} a {slot.end}
        </span>{" "}
        · {when}
        {slot.label && <span className="text-ivory-3"> · {slot.label}</span>}
        {!slot.active && <span className="text-ivory-3"> · pausado</span>}
      </span>
      <Switch
        className="data-checked:bg-ivory-2"
        checked={slot.active}
        disabled={pending}
        aria-label={slot.active ? "Pausar este turno fijo" : "Reactivar este turno fijo"}
        onCheckedChange={(v) =>
          startTransition(async () => {
            const res = await saveFixedSlot({
              id: slot.id,
              staffId: slot.staffId,
              repeat: slot.weekday !== null ? "weekly" : "once",
              weekday: slot.weekday ?? undefined,
              onDate: slot.onDate ?? undefined,
              start: slot.start,
              end: slot.end,
              label: slot.label ?? undefined,
              active: v,
            })
            if (!res.ok) toast.error(res.error)
          })
        }
      />
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Quitar turno fijo"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await removeFixedSlot(slot.id)
            if (res.ok) toast.success("Turno fijo quitado")
            else toast.error(res.error)
          })
        }
      >
        <Trash2 />
      </Button>
    </li>
  )
}

function SlotDialog({ slot, staff, today, onClose }: { slot: Partial<FixedSlot>; staff: Staff[]; today: string; onClose: () => void }) {
  const [staffId, setStaffId] = useState(slot.staffId ?? staff[0]?.id ?? "")
  const [repeat, setRepeat] = useState<"weekly" | "once">(slot.onDate ? "once" : "weekly")
  const [weekday, setWeekday] = useState(slot.weekday ?? OPEN_DAYS[0])
  const [onDate, setOnDate] = useState(slot.onDate ?? today)
  const [start, setStart] = useState(slot.start ?? "18:00")
  const [end, setEnd] = useState(slot.end ?? "19:00")
  const [label, setLabel] = useState(slot.label ?? "")
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await saveFixedSlot({
        id: slot.id,
        staffId,
        repeat,
        weekday,
        onDate,
        start,
        end,
        label,
        active: slot.active ?? true,
      })
      if (!res.ok) return void toast.error(res.error)
      if (res.overlapping) {
        toast.warning(`Guardado. Ojo: ya hay ${res.overlapping} turno${res.overlapping === 1 ? "" : "s"} cargado${res.overlapping === 1 ? "" : "s"} en ese horario. Movelos desde la agenda.`)
      } else toast.success("Turno fijo guardado")
      onClose()
    })
  }

  const select = "num h-10 rounded-lg border border-line-strong bg-surface-2 px-2 text-[14px] text-ivory"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">{slot.id ? "Editar turno fijo" : "Nuevo turno fijo"}</DialogTitle>
          <DialogDescription className="text-ivory-3">Ese horario deja de ofrecerse a los demás clientes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] text-ivory-2">Barbero</legend>
            <div className="grid grid-cols-3 gap-1.5">
              {staff.map((m) => (
                <Choice key={m.id} active={staffId === m.id} onClick={() => setStaffId(m.id)}>
                  {m.name}
                </Choice>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-1.5">
            <Choice active={repeat === "weekly"} onClick={() => setRepeat("weekly")}>
              Todas las semanas
            </Choice>
            <Choice active={repeat === "once"} onClick={() => setRepeat("once")}>
              Un solo día
            </Choice>
          </div>

          {repeat === "weekly" ? (
            <fieldset>
              <legend className="mb-1.5 text-[12.5px] text-ivory-2">Día</legend>
              <div className="grid grid-cols-5 gap-1.5">
                {OPEN_DAYS.map((wd) => (
                  <Choice key={wd} active={weekday === wd} onClick={() => setWeekday(wd)}>
                    {WEEKDAY_SHORT[wd]}
                  </Choice>
                ))}
              </div>
            </fieldset>
          ) : (
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] text-ivory-2">Fecha</span>
              <input
                type="date"
                value={onDate}
                min={today}
                onChange={(e) => setOnDate(e.target.value)}
                className="num h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory [color-scheme:dark] focus:border-gold/50 focus:outline-none"
              />
            </label>
          )}

          <div className="flex items-center gap-2 text-[13px] text-ivory-3">
            De
            <select value={start} onChange={(e) => setStart(e.target.value)} aria-label="Desde" className={select}>
              {HOURS.slice(0, -1).map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
            a
            <select value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Hasta" className={select}>
              {HOURS.slice(1).map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-ivory-2">¿Quién es? (opcional, sólo lo ve el equipo)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej. Juan, corte y barba"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none"
            />
          </label>

          <Button size="lg" className="h-10 w-full font-semibold" disabled={pending || !staffId} onClick={submit}>
            {pending ? "Guardando…" : "Guardar turno fijo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
