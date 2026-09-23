"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { VirexMark } from "@/components/brand/virex-mark"
import { OperonBadge } from "@/components/brand/operon-badge"
import { cn } from "@/lib/utils"
import { NAV, SETTINGS_ITEM, isActive, type NavItem } from "./nav"

export interface ShellInfo {
  unread: number
  needsHuman: number
  agentEnabled: boolean
}

/**
 * Sidebar de escritorio. El fondo lleva las listas verticales de la pared del
 * local (`bg-slats`), apenas perceptibles: se sienten más de lo que se ven.
 */
export function Sidebar({ info }: { info: ShellInfo }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 flex-col border-r border-line bg-obsidian bg-slats lg:flex">
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-7" aria-label="Virex — Hoy">
        <span data-brand-anchor className="grid">
          <VirexMark size={36} />
        </span>
        <span className="leading-none">
          <span className="block font-display text-gold-metal text-[19px] tracking-[0.05em]">VIREX</span>
          <span className="eyebrow mt-1 block text-[9.5px] tracking-[0.3em]">Barbershop</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 scroll-thin" aria-label="Secciones">
        {NAV.map((group) => (
          <div key={group.group}>
            <p className="eyebrow mb-1.5 px-3 text-[10px]">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item.href)} info={info} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-line px-3 pt-3 pb-4">
        <NavLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} info={info} />
        <div className="flex items-center gap-3 px-3 pt-1">
          <span className="grid size-8 place-items-center rounded-full bg-surface-3 font-wide text-[13px] font-semibold text-ivory">
            L
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-medium text-ivory">Santi</span>
            <span className="block text-[11px] text-ivory-3">Dueño</span>
          </span>
        </div>
        <OperonBadge className="px-3" />
      </div>
    </aside>
  )
}

function NavLink({ item, active, info }: { item: NavItem; active: boolean; info: ShellInfo }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors",
        active ? "bg-surface-2 text-ivory" : "text-ivory-2 hover:bg-surface-1 hover:text-ivory"
      )}
    >
      {active && <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-[2px] rounded-full bg-gold" />}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-gold" : "text-ivory-3 group-hover:text-ivory-2")} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {item.badge === "unread" && info.unread > 0 && (
        <span
          className={cn(
            "num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold",
            info.needsHuman > 0 ? "bg-danger text-obsidian" : "bg-surface-3 text-ivory"
          )}
          aria-label={`${info.unread} sin leer`}
        >
          {info.unread}
        </span>
      )}
      {item.badge === "agent" && (
        <span
          className={cn("size-2 rounded-full", info.agentEnabled ? "bg-ok" : "bg-ivory-3/50")}
          style={info.agentEnabled ? { animation: "live-pulse 2.4s ease-out infinite" } : undefined}
          aria-label={info.agentEnabled ? "Agente en línea" : "Agente pausado"}
        />
      )}
    </Link>
  )
}
