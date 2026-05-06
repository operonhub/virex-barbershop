import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Pago } from '@/types'
import { MOCK_PAGOS } from '@/lib/mockData'
import { generateId, today } from '@/lib/utils'

interface PagosStore {
  pagos: Pago[]
  addPago: (pago: Omit<Pago, 'id'>) => void
  updatePago: (id: string, updates: Partial<Pago>) => void
  getTotalMes: () => number
  getTotalHoy: () => number
  getTicketPromedio: () => number
}

export const usePagosStore = create<PagosStore>()(
  persist(
    (set, get) => ({
      pagos: MOCK_PAGOS,
      addPago: (pago) =>
        set((s) => ({ pagos: [...s.pagos, { ...pago, id: generateId() }] })),
      updatePago: (id, updates) =>
        set((s) => ({
          pagos: s.pagos.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      getTotalMes: () => {
        const t = today()
        const mes = t.slice(0, 7)
        return get()
          .pagos.filter((p) => p.fecha.startsWith(mes) && p.estado === 'pagado')
          .reduce((sum, p) => sum + p.monto, 0)
      },
      getTotalHoy: () => {
        const t = today()
        return get()
          .pagos.filter((p) => p.fecha === t && p.estado === 'pagado')
          .reduce((sum, p) => sum + p.monto, 0)
      },
      getTicketPromedio: () => {
        const pagados = get().pagos.filter((p) => p.estado === 'pagado')
        if (!pagados.length) return 0
        return pagados.reduce((sum, p) => sum + p.monto, 0) / pagados.length
      },
    }),
    { name: 'barberpro-pagos' }
  )
)
