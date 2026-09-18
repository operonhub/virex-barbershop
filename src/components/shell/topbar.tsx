"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Hand, FlaskConical } from "lucide-react"
import { VirexMark } from "@/components/brand/virex-mark"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { dayKey, formatDayLong, hm } from "@/lib/time"
import { NAV, SETTINGS_ITEM, isActive } from "./nav"
import type { ShellInfo } from "./sidebar"

/**
 * Barra superior: fecha y hora (el reloj que manda en una barbería), aviso
 * de conversaciones que esperan a una persona y, si la demo corre con reloj
 * simulado, la etiqueta que lo dice — nunca hacerle creer al cliente que es
 * la hora real.
 */
export function Topbar({ info, now, simulated }: { info: ShellInfo; now: string; simulated: boolean }) {
  const pathname = usePathname()
  const clock = useClock(now, simulated)
  const title =
    [...NAV.flatMap((g) => g.items), SETTINGS_ITEM].find((i) => isActive(pathname, i.href))?.label ?? ""

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-obsidian/85 px-4 backdrop-blur-md sm:px-6 lg:h-16 lg:px-8">
      <Link href="/" className="lg:hidden" aria-label="Virex — Hoy">
        <span data-brand-anchor className="grid">
          <VirexMark size={30} />
        </span>
      </Link>
      <span className="font-display text-[15px] text-ivory lg:hidden">{title}</span>

      <p className="hidden items-baseline gap-2 lg:flex">
        <span className="text-[14px] font-medium text-ivory first-letter:uppercase">{formatDayLong(dayKey(clock))}</span>
        <span className="num text-[14px] text-ivory-3">{hm(clock)}</span>
      </p>

      {simulated && (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-[11px] font-medium text-ivory-2" />
            }
          >
            <FlaskConical className="size-3" /> Demo
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            El local está cerrado a esta hora, así que la demo simula una tarde de trabajo. Los datos son de ejemplo.
          </TooltipContent>
        </Tooltip>
      )}

      <div className="ml-auto flex items-center gap-2">
        {info.needsHuman > 0 && (
          <Link
            href="/bandeja?filtro=humano"
            className="inline-flex h-8 items-center gap-2 rounded-full bg-danger/12 px-3 text-[12.5px] font-medium text-danger ring-1 ring-danger/30 transition-colors hover:bg-danger/20"
          >
            <Hand className="size-3.5" />
            <span className="num">{info.needsHuman}</span>
            <span className="hidden sm:inline">
              {info.needsHuman === 1 ? "chat espera a una persona" : "chats esperan a una persona"}
            </span>
          </Link>
        )}
      </div>
    </header>
  )
}

/**
 * Reloj que avanza. En modo demo arranca desde la hora simulada y corre a la
 * par del real, así la línea de "ahora" de la agenda se mueve.
 */
function useClock(initial: string, simulated: boolean) {
  const [offset] = useState(() => (simulated ? new Date(initial).getTime() - Date.now() : 0))
  const [tick, setTick] = useState(() => new Date(initial).getTime())
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now() + offset), 20_000)
    return () => window.clearInterval(id)
  }, [offset])
  return new Date(tick)
}
