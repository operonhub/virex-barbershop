import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Conversacion } from '@/types'
import { MOCK_CONVERSACIONES } from '@/lib/mockData'
import { generateId } from '@/lib/utils'

interface ConversacionesStore {
  conversaciones: Conversacion[]
  activeId: string | null
  setActive: (id: string) => void
  sendMessage: (conversacionId: string, texto: string) => void
  markAsRead: (conversacionId: string) => void
}

export const useConversacionesStore = create<ConversacionesStore>()(
  persist(
    (set) => ({
      conversaciones: MOCK_CONVERSACIONES,
      activeId: MOCK_CONVERSACIONES[0]?.id ?? null,
      setActive: (id) => set({ activeId: id }),
      sendMessage: (conversacionId, texto) =>
        set((s) => ({
          conversaciones: s.conversaciones.map((c) =>
            c.id === conversacionId
              ? {
                  ...c,
                  ultimoMensaje: texto,
                  timestamp: 'Ahora',
                  mensajes: [
                    ...c.mensajes,
                    { id: generateId(), texto, timestamp: 'Ahora', fromClient: false },
                  ],
                }
              : c
          ),
        })),
      markAsRead: (conversacionId) =>
        set((s) => ({
          conversaciones: s.conversaciones.map((c) =>
            c.id === conversacionId ? { ...c, noLeidos: 0 } : c
          ),
        })),
    }),
    { name: 'barberpro-conversaciones-v2' }
  )
)
