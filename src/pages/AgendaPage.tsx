import { useState } from 'react'
import { Plus, Link2, ChevronLeft, ChevronRight, Clock, Phone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAgendaStore } from '@/store/useAgendaStore'
import { usePagosStore } from '@/store/usePagosStore'
import { formatDate, today, addDays } from '@/lib/utils'
import { SERVICIOS_PRECIOS } from '@/types'
import type { Turno } from '@/types'

const HORAS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30']

export default function AgendaPage() {
  const [fecha, setFecha] = useState(today())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clienteNombre: '', clienteTelefono: '', servicio: '', hora: '', estado: 'confirmado' as Turno['estado'] })

  const { getTurnosByFecha, addTurno, updateTurno, deleteTurno } = useAgendaStore()
  const { getTotalHoy } = usePagosStore()
  const turnos = getTurnosByFecha(fecha)
  const isToday = fecha === today()

  const totalIngresos = turnos.filter(t => t.estado !== 'cancelado').reduce((s, t) => s + t.precio, 0)
  const totalConfirmados = turnos.filter(t => t.estado === 'confirmado').length
  const ocupacion = HORAS.length > 0 ? Math.round((turnos.filter(t => t.estado !== 'cancelado').length / HORAS.length) * 100) : 0

  function handleSubmit() {
    if (!form.clienteNombre || !form.servicio || !form.hora) {
      toast.error('Completá todos los campos requeridos')
      return
    }
    addTurno({ ...form, fecha, precio: SERVICIOS_PRECIOS[form.servicio] ?? 0 })
    setOpen(false)
    setForm({ clienteNombre: '', clienteTelefono: '', servicio: '', hora: '', estado: 'confirmado' })
    toast.success(`Turno agregado para ${form.clienteNombre}`)
  }

  function copyLink() {
    const url = `${window.location.origin}/booking/barbero1`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado al portapapeles'))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatDate(fecha)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Link2 className="w-4 h-4" />
            Link de reserva
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />
            Nuevo turno
          </Button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => setFecha(addDays(fecha, -1))} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={() => setFecha(today())} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${isToday ? 'bg-lime-400 text-black' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Hoy
        </button>
        <button onClick={() => setFecha(addDays(fecha, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Turnos', value: String(turnos.filter(t => t.estado !== 'cancelado').length), sub: `${totalConfirmados} confirmados` },
          { label: 'Ingresos estimados', value: `$${totalIngresos.toLocaleString('es-AR')}`, sub: isToday ? `$${getTotalHoy().toLocaleString('es-AR')} cobrado` : 'proyectado' },
          { label: 'Ocupación', value: `${ocupacion}%`, sub: `${turnos.length} de ${HORAS.length} slots` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-2xl font-display font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Turnos list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {turnos.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Sin turnos para este día</p>
            <p className="text-sm text-gray-300 mt-1">Agrega uno o compartí tu link de reserva</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {turnos.map((turno) => (
              <div key={turno.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 group transition-colors">
                <div className="w-12 text-sm font-mono font-medium text-gray-500 flex-shrink-0">{turno.hora}</div>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: turno.estado === 'confirmado' ? '#84cc16' : turno.estado === 'pendiente' ? '#eab308' : '#ef4444' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">{turno.clienteNombre}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{turno.servicio}</span>
                    {turno.clienteTelefono && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{turno.clienteTelefono}</span>}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900">${turno.precio.toLocaleString('es-AR')}</div>
                <Badge variant={turno.estado as 'confirmado' | 'pendiente' | 'cancelado'}>{turno.estado}</Badge>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {turno.estado === 'pendiente' && (
                    <button onClick={() => updateTurno(turno.id, { estado: 'confirmado' })} className="text-xs px-2 py-1 rounded bg-lime-50 text-lime-700 hover:bg-lime-100 font-medium">Confirmar</button>
                  )}
                  <button onClick={() => { deleteTurno(turno.id); toast.success('Turno eliminado') }} className="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog nuevo turno */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo turno</DialogTitle>
            <DialogDescription>Completá los datos del cliente y el servicio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre del cliente *</Label>
                <Input placeholder="Ej: Matías Rodríguez" value={form.clienteNombre} onChange={e => setForm(f => ({ ...f, clienteNombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input placeholder="+54 9 11..." value={form.clienteTelefono} onChange={e => setForm(f => ({ ...f, clienteTelefono: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Servicio *</Label>
                <Select value={form.servicio} onValueChange={v => setForm(f => ({ ...f, servicio: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(SERVICIOS_PRECIOS).map(s => (
                      <SelectItem key={s} value={s}>{s} — ${SERVICIOS_PRECIOS[s].toLocaleString('es-AR')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Hora *</Label>
                <Select value={form.hora} onValueChange={v => setForm(f => ({ ...f, hora: v }))}>
                  <SelectTrigger><SelectValue placeholder="Horario" /></SelectTrigger>
                  <SelectContent>
                    {HORAS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v as Turno['estado'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Agregar turno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Calendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}
