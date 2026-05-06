import { useState } from 'react'
import { Scissors, Check, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SERVICIOS_PRECIOS } from '@/types'

const HORAS_DISPONIBLES = ['09:00','09:30','10:00','10:30','11:00','12:00','14:00','14:30','15:00','16:00','17:00','17:30','18:00','19:00']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function BookingPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedHora, setSelectedHora] = useState<string | null>(null)
  const [selectedServicio, setSelectedServicio] = useState<string | null>(null)
  const [step, setStep] = useState<'servicio' | 'fecha' | 'form' | 'success'>('servicio')
  const [form, setForm] = useState({ nombre: '', telefono: '' })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const isAvailable = (day: number) => {
    const d = new Date(year, month, day)
    return d >= today && d.getDay() !== 0
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  function handleConfirm() {
    if (!form.nombre || !form.telefono) return
    setStep('success')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-400 rounded-xl flex items-center justify-center">
            <Scissors className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-bold text-gray-900">BarberPro</div>
            <div className="text-xs text-gray-500">Juan el Barbero · Reserva tu turno</div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8">
        {step === 'success' ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-lime-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-black" strokeWidth={3} />
            </div>
            <h2 className="text-xl font-display font-bold text-gray-900 mb-2">¡Turno reservado!</h2>
            <p className="text-gray-500 mb-1">
              {selectedServicio} · {selectedDay}/{month+1}/{year} a las {selectedHora}
            </p>
            <p className="text-gray-500">Te esperamos, <strong>{form.nombre}</strong></p>
            <p className="text-xs text-gray-400 mt-4">Recibirás una confirmación por WhatsApp al {form.telefono}</p>
          </div>
        ) : (
          <>
            {/* Progress steps */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(['servicio', 'fecha', 'form'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    step === s ? 'bg-zinc-900 text-white' :
                    (['fecha','form'].indexOf(step) > (['servicio','fecha','form'].indexOf(s))) ? 'bg-lime-400 text-black' :
                    'bg-gray-200 text-gray-400'
                  )}>
                    {['servicio','fecha','form'].indexOf(step) > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="text-xs text-gray-400 hidden sm:block">{['Servicio','Fecha','Datos'][i]}</span>
                  {i < 2 && <div className="w-8 h-px bg-gray-200" />}
                </div>
              ))}
            </div>

            {step === 'servicio' && (
              <div>
                <h2 className="text-lg font-display font-bold text-gray-900 mb-4">¿Qué servicio necesitás?</h2>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(SERVICIOS_PRECIOS).map(([servicio, precio]) => (
                    <button
                      key={servicio}
                      onClick={() => setSelectedServicio(servicio)}
                      className={cn(
                        'flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all',
                        selectedServicio === servicio
                          ? 'border-lime-400 bg-lime-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', selectedServicio === servicio ? 'bg-lime-400' : 'bg-gray-100')}>
                          <Scissors className={cn('w-4 h-4', selectedServicio === servicio ? 'text-black' : 'text-gray-500')} />
                        </div>
                        <span className="font-medium text-gray-900">{servicio}</span>
                      </div>
                      <span className="font-bold text-gray-900">${precio.toLocaleString('es-AR')}</span>
                    </button>
                  ))}
                </div>
                <Button className="w-full mt-6" disabled={!selectedServicio} onClick={() => setStep('fecha')}>
                  Continuar
                </Button>
              </div>
            )}

            {step === 'fecha' && (
              <div>
                <h2 className="text-lg font-display font-bold text-gray-900 mb-4">Elegí día y horario</h2>
                {/* Calendar */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="font-semibold text-gray-900">{MESES[month]} {year}</span>
                    <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1
                      const avail = isAvailable(day)
                      const selected = selectedDay === day
                      return (
                        <button
                          key={day}
                          disabled={!avail}
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            'aspect-square rounded-lg text-sm font-medium transition-all',
                            selected ? 'bg-zinc-900 text-white' :
                            avail ? 'hover:bg-gray-100 text-gray-900' :
                            'text-gray-300 cursor-not-allowed'
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Horarios */}
                {selectedDay && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Horarios disponibles</p>
                    <div className="grid grid-cols-4 gap-2">
                      {HORAS_DISPONIBLES.map(h => (
                        <button
                          key={h}
                          onClick={() => setSelectedHora(h)}
                          className={cn(
                            'py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-1',
                            selectedHora === h
                              ? 'border-lime-400 bg-lime-400 text-black'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          )}
                        >
                          <Clock className="w-3 h-3" />
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep('servicio')} className="flex-1">Atrás</Button>
                  <Button className="flex-1" disabled={!selectedDay || !selectedHora} onClick={() => setStep('form')}>Continuar</Button>
                </div>
              </div>
            )}

            {step === 'form' && (
              <div>
                <h2 className="text-lg font-display font-bold text-gray-900 mb-1">Tus datos</h2>
                <p className="text-sm text-gray-500 mb-6">
                  {selectedServicio} · {selectedDay}/{month+1}/{year} a las {selectedHora}
                </p>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nombre completo</Label>
                    <Input placeholder="Tu nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teléfono (WhatsApp)</Label>
                    <Input placeholder="+54 9 11 ..." value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep('fecha')} className="flex-1">Atrás</Button>
                  <Button className="flex-1" disabled={!form.nombre || !form.telefono} onClick={handleConfirm}>
                    Confirmar turno
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
