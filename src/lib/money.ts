import type { PaymentMethod } from "@/lib/domain/types"

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
})
const plain = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })

/** "$ 186.000" */
export function formatARS(amount: number): string {
  return ars.format(Math.round(amount))
}

/** "186.000" — para cuando el signo va aparte, más chico. */
export function formatNumber(amount: number): string {
  return plain.format(Math.round(amount))
}

/** "$186k" · "$1,2M" — sólo para ejes de gráficos, nunca para montos a cobrar. */
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`
  }
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1_000)}k`
  return `$${amount}`
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  debito: "Débito",
  credito: "Crédito",
}

export const METHODS: PaymentMethod[] = [
  "efectivo",
  "transferencia",
  "mercadopago",
  "debito",
  "credito",
]

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** Variación porcentual con signo, o null si no hay base de comparación. */
export function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
