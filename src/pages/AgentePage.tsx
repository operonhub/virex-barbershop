import { useState } from 'react'
import { Check, Bot, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAgenteStore } from '@/store/useAgenteStore'
import { cn } from '@/lib/utils'
import { SERVICIOS_PRECIOS } from '@/types'

const PASOS = ['Identidad', 'Conocimiento', 'Redes', 'Resumen']

const TONOS = [
  { value: 'formal', label: 'Formal', desc: 'Profesional y directo', emoji: '👔' },
  { value: 'amigable', label: 'Amigable', desc: 'Cálido y cercano', emoji: '😊' },
  { value: 'casual', label: 'Casual', desc: 'Relajado, como entre amigos', emoji: '✌️' },
]

const REDES = [
  { key: 'whatsapp' as const, label: 'WhatsApp', color: 'bg-green-500', desc: 'Responde mensajes directos' },
  { key: 'instagram' as const, label: 'Instagram', color: 'bg-pink-500', desc: 'Responde DMs de Instagram' },
  { key: 'tiktok' as const, label: 'TikTok', color: 'bg-zinc-800', desc: 'Responde mensajes de TikTok' },
]

export default function AgentePage() {
  const { config, updateConfig, toggleRed } = useAgenteStore()
  const [paso, setPaso] = useState(0)
  const [local, setLocal] = useState({ ...config })

  function handleNext() {
    if (paso < PASOS.length - 1) {
      setPaso(p => p + 1)
    } else {
      updateConfig({ ...local, configurado: true })
      toast.success('¡Agente configurado exitosamente!')
    }
  }

  function handleBack() {
    if (paso > 0) setPaso(p => p - 1)
  }

  const toggleServicio = (s: string) => {
    setLocal(l => ({
      ...l,
      servicios: l.servicios.includes(s) ? l.servicios.filter(x => x !== s) : [...l.servicios, s],
    }))
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-gray-900">Agente IA</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configurá tu asistente virtual para redes sociales</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-0 mb-10">
        {PASOS.map((p, i) => (
          <div key={p} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i <= paso && setPaso(i)}
              className={cn(
                'flex items-center gap-2 cursor-default',
                i < paso && 'cursor-pointer'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                i < paso ? 'bg-lime-400 text-black' : i === paso ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-400'
              )}>
                {i < paso ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn('text-sm font-medium hidden sm:block', i === paso ? 'text-gray-900' : 'text-gray-400')}>{p}</span>
            </button>
            {i < PASOS.length - 1 && (
              <div className={cn('flex-1 h-px mx-3', i < paso ? 'bg-lime-400' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-64">
        {paso === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Identidad del agente</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nombre del agente</Label>
                  <Input
                    value={local.nombre}
                    onChange={e => setLocal(l => ({ ...l, nombre: e.target.value }))}
                    placeholder="ej: BarberBot, Asistente de Juan..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tono de comunicación</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {TONOS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setLocal(l => ({ ...l, tono: t.value as typeof l.tono }))}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          local.tono === t.value
                            ? 'border-lime-400 bg-lime-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="text-2xl mb-2">{t.emoji}</div>
                        <div className="font-medium text-sm text-gray-900">{t.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {paso === 1 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Conocimiento del agente</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Servicios que ofrece</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(SERVICIOS_PRECIOS).map(s => (
                    <button
                      key={s}
                      onClick={() => toggleServicio(s)}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all',
                        local.servicios.includes(s)
                          ? 'border-lime-400 bg-lime-50 text-lime-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      <div className={cn('w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0',
                        local.servicios.includes(s) ? 'border-lime-400 bg-lime-400' : 'border-gray-300'
                      )}>
                        {local.servicios.includes(s) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="flex-1">{s}</span>
                      <span className="text-xs text-gray-400">${SERVICIOS_PRECIOS[s].toLocaleString('es-AR')}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Horario de atención</Label>
                <Input value={local.horario} onChange={e => setLocal(l => ({ ...l, horario: e.target.value }))} placeholder="ej: Lunes a Sábado 9:00 a 20:00" />
              </div>
              <div className="space-y-1.5">
                <Label>Política de cancelación</Label>
                <Input value={local.politicaCancelacion} onChange={e => setLocal(l => ({ ...l, politicaCancelacion: e.target.value }))} placeholder="ej: Cancelar con 2 horas de anticipación" />
              </div>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-gray-900">Conectar redes sociales</h2>
            <div className="space-y-3">
              {REDES.map(red => (
                <div key={red.key} className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                  local.redes[red.key] ? 'border-lime-400 bg-lime-50' : 'border-gray-200'
                )}>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', red.color)}>
                    <span className="text-white text-sm font-bold">{red.label[0]}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{red.label}</div>
                    <div className="text-xs text-gray-500">{red.desc}</div>
                  </div>
                  <Switch
                    checked={local.redes[red.key]}
                    onCheckedChange={() => setLocal(l => ({ ...l, redes: { ...l.redes, [red.key]: !l.redes[red.key] } }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
              La conexión real con las plataformas se realiza a través de la API de cada red social. Esta es una configuración simulada.
            </p>
          </div>
        )}

        {paso === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-lime-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{local.nombre || 'Tu agente'}</h2>
                <div className="text-sm text-gray-500 capitalize">Tono {local.tono}</div>
              </div>
              {config.configurado && (
                <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-lime-700 bg-lime-50 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" /> Activo
                </span>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-400 w-32 flex-shrink-0">Servicios:</span>
                <span className="text-gray-700">{local.servicios.length > 0 ? local.servicios.join(', ') : '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-32 flex-shrink-0">Horario:</span>
                <span className="text-gray-700">{local.horario || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-32 flex-shrink-0">Cancelación:</span>
                <span className="text-gray-700">{local.politicaCancelacion || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400 w-32 flex-shrink-0">Redes activas:</span>
                <span className="text-gray-700">
                  {Object.entries(local.redes).filter(([, v]) => v).map(([k]) => k).join(', ') || 'Ninguna'}
                </span>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Preview respuesta</div>
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 max-w-xs">
                Hola! Soy {local.nombre || 'el asistente'} 👋 Trabajo en BarberPro. ¿En qué te puedo ayudar? Te puedo informar sobre nuestros servicios y ayudarte a reservar un turno.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={handleBack} disabled={paso === 0}>Atrás</Button>
        <Button onClick={handleNext}>
          {paso === PASOS.length - 1 ? 'Guardar configuración' : 'Siguiente'}
        </Button>
      </div>
    </div>
  )
}
