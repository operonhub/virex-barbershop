import { useState } from 'react'
import { Plus, DollarSign, TrendingUp, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePagosStore } from '@/store/usePagosStore'
import { today, formatDateShort } from '@/lib/utils'
import { SERVICIOS_PRECIOS } from '@/types'
import type { Pago } from '@/types'

const METODOS: Pago['metodo'][] = ['efectivo', 'transferencia', 'debito']

export default function PagosPage() {
  const { pagos, addPago, getTotalMes, getTicketPromedio } = usePagosStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<Pago, 'id'>>({
    clienteNombre: '', servicio: '', monto: 0, metodo: 'efectivo', fecha: today(), estado: 'pagado',
  })

  const totalMes = getTotalMes()
  const ticketProm = Math.round(getTicketPromedio())
  const totalHoy = pagos.filter(p => p.fecha === today() && p.estado === 'pagado').reduce((s, p) => s + p.monto, 0)

  function handleSubmit() {
    if (!form.clienteNombre || !form.servicio || form.monto <= 0) {
      toast.error('Completá todos los campos')
      return
    }
    addPago(form)
    setOpen(false)
    setForm({ clienteNombre: '', servicio: '', monto: 0, metodo: 'efectivo', fecha: today(), estado: 'pagado' })
    toast.success(`Pago registrado — $${form.monto.toLocaleString('es-AR')}`)
  }

  const pagosOrdenados = [...pagos].sort((a, b) => b.fecha.localeCompare(a.fecha))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Pagos & Finanzas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historial y gestión de cobros</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          Nuevo pago
        </Button>
      </div>

      {/* Finance cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: DollarSign, label: 'Ingresos del mes', value: `$${totalMes.toLocaleString('es-AR')}`, sub: 'cobrado este mes', color: 'text-lime-500' },
          { icon: Receipt, label: 'Cobrado hoy', value: `$${totalHoy.toLocaleString('es-AR')}`, sub: `${pagos.filter(p => p.fecha === today()).length} pagos hoy`, color: 'text-blue-500' },
          { icon: TrendingUp, label: 'Ticket promedio', value: `$${ticketProm.toLocaleString('es-AR')}`, sub: 'por transacción', color: 'text-purple-500' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-semibold text-gray-900">Historial de pagos</span>
          <span className="text-sm text-gray-400">{pagos.length} transacciones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicio</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Método</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagosOrdenados.map(pago => (
                <tr key={pago.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{formatDateShort(pago.fecha)}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{pago.clienteNombre}</td>
                  <td className="px-5 py-3 text-gray-600">{pago.servicio}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">${pago.monto.toLocaleString('es-AR')}</td>
                  <td className="px-5 py-3"><Badge variant={pago.metodo}>{pago.metodo}</Badge></td>
                  <td className="px-5 py-3">
                    <Badge variant={pago.estado === 'pagado' ? 'confirmado' : 'pendiente'}>{pago.estado}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>Ingresá los datos del cobro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Input placeholder="Nombre del cliente" value={form.clienteNombre} onChange={e => setForm(f => ({ ...f, clienteNombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Servicio *</Label>
                <Select value={form.servicio} onValueChange={v => setForm(f => ({ ...f, servicio: v, monto: SERVICIOS_PRECIOS[v] ?? f.monto }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(SERVICIOS_PRECIOS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monto *</Label>
                <Input type="number" placeholder="0" value={form.monto || ''} onChange={e => setForm(f => ({ ...f, monto: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={form.metodo} onValueChange={v => setForm(f => ({ ...f, metodo: v as Pago['metodo'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS.map(m => <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as Pago['estado'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
