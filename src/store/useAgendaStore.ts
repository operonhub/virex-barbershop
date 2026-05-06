import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Turno } from '@/types'
import { MOCK_TURNOS } from '@/lib/mockData'
import { generateId } from '@/lib/utils'

interface AgendaStore {
  turnos: Turno[]
  addTurno: (turno: Omit<Turno, 'id'>) => void
  updateTurno: (id: string, updates: Partial<Turno>) => void
  deleteTurno: (id: string) => void
  getTurnosByFecha: (fecha: string) => Turno[]
}

export const useAgendaStore = create<AgendaStore>()(
  persist(
    (set, get) => ({
      turnos: MOCK_TURNOS,
      addTurno: (turno) =>
        set((s) => ({ turnos: [...s.turnos, { ...turno, id: generateId() }] })),
      updateTurno: (id, updates) =>
        set((s) => ({
          turnos: s.turnos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      deleteTurno: (id) =>
        set((s) => ({ turnos: s.turnos.filter((t) => t.id !== id) })),
      getTurnosByFecha: (fecha) =>
        get().turnos.filter((t) => t.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora)),
    }),
    { name: 'barberpro-agenda' }
  )
)
