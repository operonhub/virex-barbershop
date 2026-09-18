"use client"

import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { CalendarCheck2, CalendarClock, CalendarX2, Hand, MessageCircle, Stamp } from "lucide-react"
import { BorderBeam } from "@/components/ui/border-beam"
import { ChannelDot } from "@/components/brand/channel-icons"
import { timeAgo } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { AgentActionKind, AgentEvent } from "@/lib/domain/types"

const ICON: Record<AgentActionKind, typeof MessageCircle> = {
  turno_creado: CalendarCheck2,
  turno_reprogramado: CalendarClock,
  turno_cancelado: CalendarX2,
  consulta_respondida: MessageCircle,
  derivado_humano: Hand,
  sello_consultado: Stamp,
}

/**
 * El agente trabajando, en vivo. El haz de luz que recorre el borde es el
 * único efecto animado de la pantalla y tiene una función: decir "esto está
 * encendido ahora". Si el agente está pausado, el haz no está.
 */
export function AgentLiveCard({
  enabled,
  conversations,
  booked,
  events,
  now,
}: {
  enabled: boolean
  conversations: number
  booked: number
  events: AgentEvent[]
  now: string
}) {
  return (
    <section className="panel relative overflow-hidden">
      {enabled && <BorderBeam size={90} duration={9} colorFrom="#f1dda6" colorTo="#8c6a2f" borderWidth={1.5} />}

      <header className="flex items-center justify-between px-5 pt-4">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold text-ivory font-wide">
          Agente IA
          <span
            className={cn(
              "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium",
              enabled ? "bg-ok/12 text-ok" : "bg-surface-3 text-ivory-3"
            )}
          >
            <span
              className={cn("size-1.5 rounded-full", enabled ? "bg-ok" : "bg-ivory-3")}
              style={enabled ? { animation: "live-pulse 2.4s ease-out infinite" } : undefined}
            />
            {enabled ? "En línea" : "Pausado"}
          </span>
        </h2>
        <Link href="/agente" className="text-[12px] text-ivory-3 hover:text-ivory">
          Configurar
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 px-5 pt-4 pb-4">
        <div>
          <p className="num font-wide text-[30px] font-semibold leading-none text-ivory">{conversations}</p>
          <p className="mt-1 text-[12px] text-ivory-3">chats atendidos hoy</p>
        </div>
        <div>
          <p className="num font-wide text-[30px] font-semibold leading-none text-ivory">{booked}</p>
          <p className="mt-1 text-[12px] text-ivory-3">turnos que agendó solo</p>
        </div>
      </div>

      <ul className="border-t border-line">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = ICON[e.kind]
            const href = e.conversationId ? `/bandeja?c=${e.conversationId}` : "/agenda"
            return (
              <motion.li
                key={e.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
              >
                <Link href={href} className="flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="relative mt-0.5">
                    <Icon className={cn("size-4", e.kind === "derivado_humano" ? "text-danger" : "text-ivory-2")} strokeWidth={1.75} />
                    <ChannelDot channel={e.channel} className="absolute -right-2 -bottom-1.5 size-3 ring-1 [&_svg]:size-2" />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-ivory-2">{e.summary}</span>
                  <span className="num shrink-0 text-[11px] text-ivory-3">{timeAgo(e.at, new Date(now))}</span>
                </Link>
              </motion.li>
            )
          })}
        </AnimatePresence>
        {events.length === 0 && (
          <li className="px-5 py-4 text-[13px] text-ivory-3">Todavía no hubo actividad hoy.</li>
        )}
      </ul>
    </section>
  )
}
