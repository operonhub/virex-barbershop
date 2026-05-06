import { useState } from 'react'
import { TrendingUp, Users, Scissors, DollarSign } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAgendaStore } from '@/store/useAgendaStore'
import { usePagosStore } from '@/store/usePagosStore'
import { today, addDays } from '@/lib/utils'

function StatCard({ icon: Icon, label, value, sub, color = 'text-lime-500' }: {
  icon: React.ElementType; label: string; value: string; sub: string; color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HORAS_PICO = ['9h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h']

export default function MetricasPage() {
  const [periodo, setPeriodo] = useState('semana')
  const { turnos } = useAgendaStore()
  const { pagos, getTotalMes, getTicketPromedio } = usePagosStore()

  const t = today()
  const pagadosMes = pagos.filter(p => p.fecha.startsWith(t.slice(0, 7)) && p.estado === 'pagado')

  const totalMes = getTotalMes()
  const ticketProm = getTicketPromedio()
  const turnosMes = turnos.filter(tr => tr.fecha.startsWith(t.slice(0, 7)) && tr.estado === 'confirmado').length

  // Clientes únicos este mes
  const clientesMes = new Set(turnos.filter(tr => tr.fecha.startsWith(t.slice(0, 7))).map(tr => tr.clienteNombre)).size

  // Datos para el gráfico — últimos 7 días
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(t, -(6 - i))
    const ingreso = pagos.filter(p => p.fecha === d && p.estado === 'pagado').reduce((s, p) => s + p.monto, 0)
    const dia = DIAS_SEMANA[new Date(d + 'T12:00:00').getDay() === 0 ? 6 : new Date(d + 'T12:00:00').getDay() - 1]
    return { dia, ingreso }
  })

  // Servicios más pedidos
  const serviciosCount: Record<string, { cantidad: number; total: number }> = {}
  pagadosMes.forEach(p => {
    if (!serviciosCount[p.servicio]) serviciosCount[p.servicio] = { cantidad: 0, total: 0 }
    serviciosCount[p.servicio].cantidad++
    serviciosCount[p.servicio].total += p.monto
  })
  const serviciosTop = Object.entries(serviciosCount).sort((a, b) => b[1].cantidad - a[1].cantidad)

  // Horas pico
  const horasCount: Record<string, number> = {}
  turnos.filter(tr => tr.estado === 'confirmado').forEach(tr => {
    const h = tr.hora.split(':')[0] + 'h'
    horasCount[h] = (horasCount[h] ?? 0) + 1
  })
  const maxHora = Math.max(...Object.values(horasCount), 1)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance del negocio</p>
        </div>
        <Tabs value={periodo} onValueChange={setPeriodo}>
          <TabsList>
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={DollarSign} label="Ingresos" value={`$${totalMes.toLocaleString('es-AR')}`} sub="este mes" color="text-lime-500" />
        <StatCard icon={Scissors} label="Turnos" value={String(turnosMes)} sub="confirmados este mes" color="text-blue-500" />
        <StatCard icon={Users} label="Clientes" value={String(clientesMes)} sub="únicos este mes" color="text-purple-500" />
        <StatCard icon={TrendingUp} label="Ticket promedio" value={`$${Math.round(ticketProm).toLocaleString('es-AR')}`} sub="por servicio" color="text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-900 mb-4">Ingresos últimos 7 días</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, 'Ingresos']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Bar dataKey="ingreso" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Servicios top */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-900 mb-4">Servicios más pedidos</div>
          {serviciosTop.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {serviciosTop.slice(0, 5).map(([servicio, data]) => (
                <div key={servicio}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium truncate">{servicio}</span>
                    <span className="text-gray-400 ml-2 flex-shrink-0">{data.cantidad}x</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-lime-400 rounded-full" style={{ width: `${(data.cantidad / serviciosTop[0][1].cantidad) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Horas pico */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <div className="text-sm font-semibold text-gray-900 mb-4">Horas pico</div>
        <div className="flex items-end gap-2 h-16">
          {HORAS_PICO.map(h => {
            const count = horasCount[h] ?? 0
            const height = maxHora > 0 ? Math.round((count / maxHora) * 100) : 0
            return (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gray-100 rounded-sm relative" style={{ height: 48 }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-lime-400 rounded-sm transition-all" style={{ height: `${height}%`, opacity: height > 0 ? 1 : 0.2 }} />
                </div>
                <span className="text-xs text-gray-400">{h}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
