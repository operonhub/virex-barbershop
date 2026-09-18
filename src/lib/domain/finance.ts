import { dayKey, monthKey } from "@/lib/time"
import type {
  Appointment,
  AppointmentSource,
  Expense,
  ExpenseCategory,
  Payment,
  PaymentMethod,
  Service,
  Staff,
} from "./types"

/**
 * Números del negocio. Funciones puras sobre listas: la misma cuenta sirve
 * para la caja del día, el cierre y el resumen del mes, y se prueba sin base.
 */

export interface MoneySummary {
  /** Todo lo que entró (servicios + productos + propinas). */
  gross: number
  services: number
  products: number
  tips: number
  discounts: number
  count: number
  /** Ticket promedio de servicios (sin propina ni productos). */
  avgTicket: number
  byMethod: Record<PaymentMethod, number>
}

export function summarizePayments(payments: Payment[]): MoneySummary {
  const byMethod: Record<PaymentMethod, number> = {
    efectivo: 0,
    transferencia: 0,
    mercadopago: 0,
    debito: 0,
    credito: 0,
  }
  let services = 0
  let products = 0
  let tips = 0
  let discounts = 0
  let serviceCount = 0

  for (const p of payments) {
    byMethod[p.method] += p.amount
    tips += p.tip
    discounts += p.discount
    if (p.kind === "producto") products += p.amount - p.tip
    else {
      services += p.amount - p.tip
      serviceCount++
    }
  }

  const gross = services + products + tips
  return {
    gross,
    services,
    products,
    tips,
    discounts,
    count: payments.length,
    avgTicket: serviceCount ? Math.round(services / serviceCount) : 0,
    byMethod,
  }
}

export function paymentsOnDay(payments: Payment[], day: string) {
  return payments.filter((p) => dayKey(p.paidAt) === day)
}

export function paymentsInMonth(payments: Payment[], month: string) {
  return payments.filter((p) => monthKey(dayKey(p.paidAt)) === month)
}

export function expensesInMonth(expenses: Expense[], month: string) {
  return expenses.filter((e) => monthKey(dayKey(e.paidAt)) === month)
}

export function expensesByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const out: Record<ExpenseCategory, number> = {
    alquiler: 0,
    servicios: 0,
    insumos: 0,
    sueldos: 0,
    marketing: 0,
    otros: 0,
  }
  for (const e of expenses) out[e.category] += e.amount
  return out
}

export interface StaffLine {
  staff: Staff
  services: number
  revenue: number
  tips: number
  /** Lo que le corresponde al barbero: comisión sobre servicios + sus propinas. */
  payout: number
}

/**
 * Liquidación por barbero. Las propinas van completas al barbero (práctica
 * habitual en AR; se confirma con Virex). La comisión se calcula sobre lo
 * efectivamente cobrado, o sea DESPUÉS del descuento de fidelidad: el premio
 * lo financia la casa y el barbero por igual.
 */
export function staffBreakdown(payments: Payment[], staff: Staff[]): StaffLine[] {
  return staff.map((member) => {
    const mine = payments.filter((p) => p.staffId === member.id && p.kind === "servicio")
    const revenue = mine.reduce((s, p) => s + p.amount - p.tip, 0)
    const tips = mine.reduce((s, p) => s + p.tip, 0)
    return {
      staff: member,
      services: mine.length,
      revenue,
      tips,
      payout: Math.round((revenue * member.commissionPct) / 100) + tips,
    }
  })
}

export function serviceBreakdown(payments: Payment[], services: Service[]) {
  return services
    .map((service) => {
      const mine = payments.filter((p) => p.serviceId === service.id)
      return {
        service,
        count: mine.length,
        revenue: mine.reduce((s, p) => s + p.amount - p.tip, 0),
      }
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

/**
 * De dónde vino la plata: cuánto facturaron los turnos que tomó el agente
 * vs. los del panel, la web o los que entraron caminando. Es el número que
 * justifica el agente frente al dueño.
 */
export function sourceBreakdown(payments: Payment[], appointments: Appointment[]) {
  const byId = new Map(appointments.map((a) => [a.id, a]))
  const out: Record<AppointmentSource, { count: number; revenue: number }> = {
    agente: { count: 0, revenue: 0 },
    panel: { count: 0, revenue: 0 },
    web: { count: 0, revenue: 0 },
    walk_in: { count: 0, revenue: 0 },
  }
  for (const p of payments) {
    const appt = p.appointmentId ? byId.get(p.appointmentId) : undefined
    if (!appt) continue
    out[appt.source].count++
    out[appt.source].revenue += p.amount - p.tip
  }
  return out
}

export function noShowRate(appointments: Appointment[]): number {
  const closed = appointments.filter((a) =>
    ["completado", "no_show"].includes(a.status)
  )
  if (!closed.length) return 0
  return Math.round((closed.filter((a) => a.status === "no_show").length / closed.length) * 100)
}

/** Serie diaria de ingresos para los gráficos del mes. */
export function dailySeries(payments: Payment[], days: string[]) {
  const totals = new Map<string, number>()
  for (const p of payments) {
    const d = dayKey(p.paidAt)
    totals.set(d, (totals.get(d) ?? 0) + p.amount)
  }
  return days.map((day) => ({ day, total: totals.get(day) ?? 0 }))
}
