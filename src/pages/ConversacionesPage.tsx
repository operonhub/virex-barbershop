import { useState } from 'react'
import { Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConversacionesStore } from '@/store/useConversacionesStore'
import { cn } from '@/lib/utils'
import type { Conversacion } from '@/types'

const PLATAFORMA_LABELS: Record<Conversacion['plataforma'], string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

function PlatformDot({ plataforma }: { plataforma: Conversacion['plataforma'] }) {
  const colors: Record<string, string> = {
    whatsapp: 'bg-green-500',
    instagram: 'bg-pink-500',
    tiktok: 'bg-zinc-800',
  }
  return <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[plataforma])} />
}

export default function ConversacionesPage() {
  const { conversaciones, activeId, setActive, sendMessage, markAsRead } = useConversacionesStore()
  const [mensaje, setMensaje] = useState('')

  const active = conversaciones.find(c => c.id === activeId)

  function handleSelect(id: string) {
    setActive(id)
    markAsRead(id)
  }

  function handleSend() {
    if (!mensaje.trim() || !activeId) return
    sendMessage(activeId, mensaje.trim())
    setMensaje('')
  }

  return (
    <div className="flex h-full">
      {/* Lista izquierda */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-lg font-display font-bold text-gray-900">Conversaciones</h1>
          <p className="text-xs text-gray-400 mt-0.5">Instagram · WhatsApp · TikTok</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversaciones.map(conv => (
            <button
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-50',
                activeId === conv.id && 'bg-lime-50 border-l-2 border-l-lime-400'
              )}
            >
              {/* Avatar */}
              <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0 relative">
                {conv.clienteNombre[0]}
                <PlatformDot plataforma={conv.plataforma} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">{conv.clienteNombre}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{conv.timestamp}</span>
                </div>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-xs text-gray-500 truncate">{conv.ultimoMensaje}</span>
                  {conv.noLeidos > 0 && (
                    <span className="bg-lime-400 text-black text-xs font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center flex-shrink-0 px-1">
                      {conv.noLeidos}
                    </span>
                  )}
                </div>
                <Badge variant={conv.plataforma} className="mt-1 text-xs py-0">
                  {PLATAFORMA_LABELS[conv.plataforma]}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Panel derecho */}
      {active ? (
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
              {active.clienteNombre[0]}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{active.clienteNombre}</div>
              <Badge variant={active.plataforma} className="text-xs">{PLATAFORMA_LABELS[active.plataforma]}</Badge>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {active.mensajes.map(msg => (
              <div key={msg.id} className={cn('flex', msg.fromClient ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-xs px-4 py-2.5 rounded-2xl text-sm',
                  msg.fromClient
                    ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    : 'bg-zinc-900 text-white rounded-br-sm'
                )}>
                  <p>{msg.texto}</p>
                  <p className={cn('text-xs mt-1', msg.fromClient ? 'text-gray-400' : 'text-zinc-400')}>{msg.timestamp}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex gap-2">
              <Input
                placeholder="Escribí un mensaje..."
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="flex-1"
              />
              <Button onClick={handleSend} size="icon" disabled={!mensaje.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Seleccioná una conversación
        </div>
      )}
    </div>
  )
}
