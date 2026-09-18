"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/shell/page-header"
import { ChannelDot } from "@/components/brand/channel-icons"
import { updateAgentSettings } from "@/lib/data/actions"
import { cn } from "@/lib/utils"
import type { AgentSettings, AgentTone } from "@/lib/domain/types"

const TONES: { id: AgentTone; label: string; sample: string }[] = [
  { id: "cercano", label: "Cercano", sample: "¡Hola Mati! Mañana tengo 18:00 con Bruno, ¿te lo reservo? 💈" },
  { id: "profesional", label: "Profesional", sample: "Hola Matías. Mañana hay lugar a las 18:00 con Bruno. ¿Lo reservo?" },
  { id: "canchero", label: "Canchero", sample: "Buenas crack! Mañana 18hs con Bruno te queda joya, ¿lo agarro?" },
]

const PERMS: { key: keyof AgentSettings["permissions"]; label: string; hint: string }[] = [
  { key: "answerPrices", label: "Informar precios y servicios", hint: "Con la lista de Ajustes, nunca inventa." },
  { key: "book", label: "Agendar turnos", hint: "Sólo en horarios que la agenda confirma libres." },
  { key: "reschedule", label: "Reprogramar turnos", hint: "Mismo servicio y barbero, otro horario." },
  { key: "cancel", label: "Cancelar turnos", hint: "Sólo los del cliente que escribe." },
  { key: "shareLoyalty", label: "Contar los sellos de fidelidad", hint: "Cuántos tiene y si le toca el 50%." },
]

/**
 * Configuración del agente, en palabras del dueño. El borrador guarda sólo lo
 * que se tocó (derivado, no copiado): si mientras tanto cambia la
 * configuración, la pantalla la refleja sin pisar lo que se está escribiendo.
 */
export function AgentSettingsForm({ settings }: { settings: AgentSettings }) {
  const [changes, setChanges] = useState<Partial<AgentSettings> | null>(null)
  const [newRule, setNewRule] = useState("")
  const [pending, startTransition] = useTransition()
  const form = changes ? { ...settings, ...changes } : settings
  const set = (patch: Partial<AgentSettings>) => setChanges((c) => ({ ...(c ?? {}), ...patch }))

  function save() {
    if (!changes) return
    startTransition(async () => {
      const res = await updateAgentSettings(changes)
      if (!res.ok) toast.error(res.error)
      else {
        toast.success("Agente actualizado. Los próximos mensajes ya usan esta configuración.")
        setChanges(null)
      }
    })
  }

  return (
    <div className="space-y-5">
      <Panel title="Personalidad">
        <label className="eyebrow mb-1.5 block text-[10px]" htmlFor="agent-name">
          Nombre
        </label>
        <input
          id="agent-name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory focus:border-gold/60 focus:outline-none"
        />
        <p className="eyebrow mt-5 mb-2 text-[10px]">Tono</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ tone: t.id })}
              aria-pressed={form.tone === t.id}
              className={cn(
                "rounded-xl border-2 px-3 py-3 text-left transition-colors",
                form.tone === t.id ? "border-gold bg-gold/8" : "border-line bg-surface-2 hover:border-line-strong"
              )}
            >
              <span className="block text-[13.5px] font-semibold text-ivory">{t.label}</span>
              <span className="mt-1 block text-[12px] leading-snug text-ivory-3">“{t.sample}”</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Canales">
        <ul className="space-y-3">
          {(["whatsapp", "instagram"] as const).map((ch) => (
            <li key={ch} className="flex items-center gap-3">
              <ChannelDot channel={ch} className="size-5 [&_svg]:size-3" />
              <span className="flex-1 text-[14px] text-ivory">{ch === "whatsapp" ? "WhatsApp" : "Instagram (DMs)"}</span>
              <Switch checked={form.channels[ch]} onCheckedChange={(v) => set({ channels: { ...form.channels, [ch]: v } })} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Qué puede hacer solo">
        <ul className="space-y-3.5">
          {PERMS.map((p) => (
            <li key={p.key} className="flex items-start gap-3">
              <span className="flex-1">
                <span className="block text-[14px] text-ivory">{p.label}</span>
                <span className="block text-[12px] text-ivory-3">{p.hint}</span>
              </span>
              <Switch
                checked={form.permissions[p.key]}
                onCheckedChange={(v) => set({ permissions: { ...form.permissions, [p.key]: v } })}
              />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Reglas del dueño">
        <p className="mb-3 text-[12.5px] text-ivory-3">En palabras normales. El agente las sigue al pie de la letra.</p>
        <ul className="space-y-2">
          {form.rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13.5px] text-ivory-2">
              <span className="flex-1">{rule}</span>
              <button
                type="button"
                aria-label="Quitar regla"
                onClick={() => set({ rules: form.rules.filter((_, j) => j !== i) })}
                className="text-ivory-3 hover:text-danger"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newRule.trim()) return
            set({ rules: [...form.rules, newRule.trim()] })
            setNewRule("")
          }}
        >
          <input
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="Ej: los sábados no agendar color"
            className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:outline-none"
          />
          <Button type="submit" variant="outline" size="lg" className="h-10">
            <Plus /> Agregar
          </Button>
        </form>
      </Panel>

      {changes && (
        <div className="sticky bottom-20 z-10 flex items-center justify-end gap-3 rounded-xl border border-line-strong bg-surface-2/95 px-4 py-3 backdrop-blur lg:bottom-4">
          <span className="mr-auto text-[13px] text-ivory-2">Hay cambios sin guardar</span>
          <Button variant="ghost" onClick={() => setChanges(null)}>
            Descartar
          </Button>
          <Button size="lg" className="h-10 px-5 font-semibold" disabled={pending} onClick={save}>
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  )
}
