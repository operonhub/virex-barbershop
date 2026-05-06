import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AgenteConfig } from '@/types'
import { MOCK_AGENTE } from '@/lib/mockData'

interface AgenteStore {
  config: AgenteConfig
  updateConfig: (updates: Partial<AgenteConfig>) => void
  toggleRed: (red: keyof AgenteConfig['redes']) => void
}

export const useAgenteStore = create<AgenteStore>()(
  persist(
    (set) => ({
      config: MOCK_AGENTE,
      updateConfig: (updates) =>
        set((s) => ({ config: { ...s.config, ...updates } })),
      toggleRed: (red) =>
        set((s) => ({
          config: {
            ...s.config,
            redes: { ...s.config.redes, [red]: !s.config.redes[red] },
          },
        })),
    }),
    { name: 'barberpro-agente' }
  )
)
