"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { CalendarDays, Ellipsis, House, MessagesSquare, Plus } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OperonBadge } from "@/components/brand/operon-badge"
import { useNewAppointment } from "@/components/agenda/new-appointment"
import { cn } from "@/lib/utils"
import { NAV, SETTINGS_ITEM, isActive } from "./nav"
import type { ShellInfo } from "./sidebar"

/**
 * Navegación de celular: lo de todos los días al alcance del pulgar y, en el
 * centro, el único botón dorado — nuevo turno.
 */
export function MobileNav({ info }: { info: ShellInfo }) {
  const pathname = usePathname()
  const { open } = useNewAppointment()
  const [more, setMore] = useState(false)
  const rest = [...NAV.flatMap((g) => g.items), SETTINGS_ITEM].filter(
    (i) => !["/", "/agenda", "/bandeja"].includes(i.href)
  )
  const restActive = rest.some((i) => isActive(pathname, i.href))

  return (
    <>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-obsidian/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          <Tab href="/" label="Hoy" icon={House} active={isActive(pathname, "/")} />
          <Tab href="/agenda" label="Agenda" icon={CalendarDays} active={isActive(pathname, "/agenda")} />
          <li className="grid place-items-center">
            <button
              type="button"
              onClick={() => open()}
              aria-label="Nuevo turno"
              className="grid size-12 -translate-y-3 place-items-center rounded-full bg-gold text-obsidian shadow-[0_8px_24px_-6px_rgb(214_179_106/0.55)] ring-4 ring-obsidian transition-transform active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2.25} />
            </button>
          </li>
          <Tab
            href="/bandeja"
            label="Bandeja"
            icon={MessagesSquare}
            active={isActive(pathname, "/bandeja")}
            badge={info.unread}
            alert={info.needsHuman > 0}
          />
          <li>
            <button
              type="button"
              onClick={() => setMore(true)}
              className={cn(
                "flex w-full flex-col items-center gap-1 text-[10.5px] font-medium",
                restActive ? "text-ivory" : "text-ivory-3"
              )}
            >
              <Ellipsis className={cn("size-5", restActive && "text-gold")} />
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl border-line px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-1">
            <SheetTitle className="font-display">Más secciones</SheetTitle>
          </SheetHeader>
          <ul className="grid grid-cols-2 gap-2">
            {rest.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMore(false)}
                    className={cn(
                      "flex h-14 items-center gap-3 rounded-xl border-2 px-4 text-[14px] font-medium",
                      active ? "border-gold/60 bg-gold/8 text-ivory" : "border-line bg-surface-1 text-ivory-2"
                    )}
                  >
                    <Icon className={cn("size-5", active ? "text-gold" : "text-ivory-3")} strokeWidth={1.75} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
          <OperonBadge className="mx-auto mt-2" />
        </SheetContent>
      </Sheet>
    </>
  )
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
  badge = 0,
  alert = false,
}: {
  href: string
  label: string
  icon: typeof House
  active: boolean
  badge?: number
  alert?: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex flex-col items-center gap-1 text-[10.5px] font-medium",
          active ? "text-ivory" : "text-ivory-3"
        )}
      >
        <Icon className={cn("size-5", active && "text-gold")} strokeWidth={1.75} />
        {label}
        {badge > 0 && (
          <span
            className={cn(
              "num absolute -top-1 left-1/2 ml-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold",
              alert ? "bg-danger text-obsidian" : "bg-ivory text-obsidian"
            )}
          >
            {badge}
          </span>
        )}
      </Link>
    </li>
  )
}
