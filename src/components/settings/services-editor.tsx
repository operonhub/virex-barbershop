"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { saveService } from "@/lib/data/settings-actions"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { Service, ServiceCategory } from "@/lib/domain/types"

const CATEGORIES: { id: ServiceCategory; label: string }[] = [
  { id: "corte", label: "Corte" },
  { id: "combo", label: "Combo" },
  { id: "barba", label: "Barba" },
  { id: "color", label: "Color" },
  { id: "extra", label: "Extra" },
]
const DURATIONS = [30, 45, 60, 90, 120]

type Draft = Omit<Service, "id"> & { id?: string }
const EMPTY: Draft = { name: "", category: "corte", durationMin: 60, price: 0, countsForLoyalty: true, active: true }

/**
 * Servicios y precios. Un precio nuevo lo usan al instante la agenda, la caja,
 * la reserva web y el agente (que lo cotiza en el mensaje siguiente).
 */
export function ServicesEditor({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Draft | null>(null)

  return (
    <section className="panel">
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[13.5px] font-semibold text-ivory font-wide">Servicios y precios</h2>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
          <Plus /> Agregar servicio
        </Button>
      </header>
      <ul className="pb-1">
        {services.map((sv) => (
          <li key={sv.id} className={cn("flex items-center gap-4 border-t border-line px-5 py-3", !sv.active && "opacity-55")}>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ivory">
                {sv.name}
                {!sv.active && <span className="ml-2 text-[11.5px] font-normal text-ivory-3">(no se ofrece)</span>}
              </span>
              <span className="block text-[12px] text-ivory-3">
                {sv.durationMin} min{sv.countsForLoyalty ? " · suma sello de fidelidad" : ""}
              </span>
            </span>
            <span className="num text-[14px] font-medium text-ivory">{formatARS(sv.price)}</span>
            <Button variant="ghost" size="icon" aria-label={`Editar ${sv.name}`} onClick={() => setEditing({ ...sv })}>
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      {editing && <ServiceDialog draft={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function ServiceDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const [d, setD] = useState(draft)
  const [price, setPrice] = useState(draft.price ? String(draft.price) : "")
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }))

  function submit() {
    startTransition(async () => {
      const res = await saveService({ ...d, price: Number(price.replace(/\D/g, "")) })
      if (!res.ok) return void toast.error(res.error)
      toast.success(d.id ? "Servicio actualizado" : "Servicio agregado")
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">{d.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          <DialogDescription className="text-ivory-3">El agente y la reserva web lo usan apenas lo guardás.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-ivory-2">Nombre</span>
            <input
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ej. Corte + barba"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] text-ivory-2">Precio</span>
            <span className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-ivory-3">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="15000"
                className="num h-10 w-full rounded-lg border border-line-strong bg-surface-2 pr-3 pl-7 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none"
              />
            </span>
          </label>
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] text-ivory-2">Duración del turno</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {DURATIONS.map((m) => (
                <Choice key={m} active={d.durationMin === m} onClick={() => set("durationMin", m)}>
                  {durationLabel(m)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[12.5px] text-ivory-2">Tipo</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map((c) => (
                <Choice key={c.id} active={d.category === c.id} onClick={() => set("category", c.id)}>
                  {c.label}
                </Choice>
              ))}
            </div>
          </fieldset>
          <Toggle label="Suma sello en la tarjeta de fidelidad" checked={d.countsForLoyalty} onChange={(v) => set("countsForLoyalty", v)} />
          <Toggle label="Se ofrece (agenda, web y agente)" checked={d.active} onChange={(v) => set("active", v)} />
          <Button size="lg" className="h-10 w-full font-semibold" disabled={pending} onClick={submit}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 30 → "30'", 60 → "1 h", 90 → "1,5 h". */
const durationLabel = (m: number) => (m < 60 ? `${m}'` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)},5 h`)

export function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 rounded-lg border text-[12.5px] font-medium transition-colors",
        active ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
      )}
    >
      {children}
    </button>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
      <span className="text-[13px] text-ivory-2">{label}</span>
      <Switch className="data-checked:bg-ivory-2" checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
