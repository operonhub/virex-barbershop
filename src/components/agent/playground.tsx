"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { CalendarCheck2, CircleAlert, RotateCcw, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { testAgent } from "@/lib/agent/actions"
import { cn } from "@/lib/utils"
import type { AgentActionKind } from "@/lib/domain/types"

type Line =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; action: AgentActionKind | null }
  | { role: "error"; text: string }

const STARTERS = ["Hola! tenés turno mañana a la tarde?", "cuánto sale corte y barba?", "me quiero cortar el sábado con Santi"]

/**
 * Chat de prueba con el agente real. Es la mejor demo posible para el dueño:
 * le escribe como si fuera un cliente y ve el turno aparecer en la agenda.
 */
export function AgentPlayground({ agentName, configured, reason }: { agentName: string; configured: boolean; reason: string | null }) {
  const [lines, setLines] = useState<Line[]>([])
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [lines.length, pending])

  function send(text = draft) {
    const body = text.trim()
    if (!body || pending) return
    const next: Line[] = [...lines, { role: "user", text: body }]
    setLines(next)
    setDraft("")
    startTransition(async () => {
      const history = next
        .filter((l): l is Exclude<Line, { role: "error" }> => l.role !== "error")
        .map((l) => ({ role: l.role, text: l.text }))
      const res = await testAgent(history)
      setLines((cur) => [...cur, res.ok ? { role: "assistant", text: res.reply, action: res.action } : { role: "error", text: res.reason }])
    })
  }

  return (
    <section className="panel flex h-[620px] flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold text-ivory font-wide">Probalo</h2>
          <p className="text-[12px] text-ivory-3">Escribile como si fueras un cliente. Usa la agenda real.</p>
        </div>
        {lines.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setLines([])}>
            <RotateCcw /> Reiniciar
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4 scroll-thin">
        {!configured && (
          <p className="flex items-start gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2.5 text-[12.5px] text-ivory-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-ivory-3" />
            <span>
              {reason} Cargala en <code className="text-ivory">.env.local</code> y reiniciá el servidor.
            </span>
          </p>
        )}
        {lines.length === 0 && configured && (
          <div className="pt-6 text-center">
            <Sparkles className="mx-auto size-6 text-gold" />
            <p className="mt-2 text-[13px] text-ivory-2">Probá con alguno de estos:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ivory-2 hover:border-line-strong hover:text-ivory"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {lines.map((l, i) =>
          l.role === "error" ? (
            <p key={i} className="rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
              {l.text}
            </p>
          ) : (
            <div key={i} className={cn("flex flex-col", l.role === "user" ? "items-start" : "items-end")}>
              {l.role === "assistant" && (
                <span className="mb-1 flex items-center gap-1 px-1 text-[11px] text-ivory-3">
                  <Sparkles className="size-3 text-gold" /> {agentName}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                  l.role === "user" ? "rounded-bl-md bg-surface-2 text-ivory" : "rounded-br-md border border-gold/20 bg-[#1d1a14] text-ivory"
                )}
              >
                {l.text}
              </div>
              {l.role === "assistant" && l.action === "turno_creado" && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] text-ivory-2">
                  <CalendarCheck2 className="size-3.5" /> Turno creado en la agenda
                </span>
              )}
            </div>
          )
        )}
        {pending && (
          <div className="flex justify-end">
            <span className="flex gap-1 rounded-2xl border border-gold/20 bg-[#1d1a14] px-4 py-3" aria-label="El agente está escribiendo">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-bounce rounded-full bg-ivory-3" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!configured}
          placeholder={configured ? "Escribí como un cliente…" : "Falta la clave de Anthropic"}
          className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none disabled:opacity-50"
        />
        <Button type="submit" size="icon-lg" disabled={!configured || !draft.trim() || pending} aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </section>
  )
}
