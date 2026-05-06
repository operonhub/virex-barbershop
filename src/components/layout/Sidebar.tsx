import { NavLink } from 'react-router-dom'
import { Calendar, MessageCircle, Bot, BarChart3, CreditCard, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConversacionesStore } from '@/store/useConversacionesStore'

const navItems = [
  { to: '/agenda', icon: Calendar, label: 'Agenda' },
  { to: '/conversaciones', icon: MessageCircle, label: 'Conversaciones' },
  { to: '/agente', icon: Bot, label: 'Agente IA' },
  { to: '/metricas', icon: BarChart3, label: 'Métricas' },
  { to: '/pagos', icon: CreditCard, label: 'Pagos' },
]

export default function Sidebar() {
  const conversaciones = useConversacionesStore((s) => s.conversaciones)
  const totalNoLeidos = conversaciones.reduce((sum, c) => sum + c.noLeidos, 0)

  return (
    <aside className="w-56 bg-zinc-950 flex flex-col h-full border-r border-zinc-800 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-lime-400 rounded-lg flex items-center justify-center">
            <Scissors className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-white text-base tracking-tight">BarberPro</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative',
                isActive
                  ? 'bg-lime-400/10 text-lime-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-lime-400 rounded-r-full" />
                )}
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {to === '/conversaciones' && totalNoLeidos > 0 && (
                  <span className="bg-lime-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalNoLeidos > 9 ? '9+' : totalNoLeidos}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center text-zinc-200 text-sm font-bold flex-shrink-0">
            J
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-200 truncate">Juan el Barbero</div>
            <div className="text-xs text-zinc-500">barbero1</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
