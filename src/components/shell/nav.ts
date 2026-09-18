import {
  Bot,
  CalendarDays,
  ChartNoAxesColumn,
  House,
  MessagesSquare,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Qué contador muestra al lado. */
  badge?: "unread" | "agent"
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Día a día",
    items: [
      { href: "/", label: "Hoy", icon: House },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/bandeja", label: "Bandeja", icon: MessagesSquare, badge: "unread" },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    group: "Plata",
    items: [
      { href: "/caja", label: "Caja", icon: Wallet },
      { href: "/finanzas", label: "Finanzas", icon: ChartNoAxesColumn },
    ],
  },
  {
    group: "Automático",
    items: [{ href: "/agente", label: "Agente IA", icon: Bot, badge: "agent" }],
  },
]

export const SETTINGS_ITEM: NavItem = { href: "/ajustes", label: "Ajustes", icon: Settings2 }

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
}
