import { describe, expect, it } from "vitest"
import { serviceBreakdown, sourceBreakdown, staffBreakdown, summarizePayments } from "./finance"
import type { Appointment, Payment, Service, Staff } from "./types"

const staff: Staff[] = [{ id: "st1", name: "Sebastián", role: "barbero", commissionPct: 50, active: true, skipsServiceIds: [] }]
const services: Service[] = [{ id: "sv1", name: "Corte + barba", category: "combo", durationMin: 60, price: 20000, countsForLoyalty: true, active: true }]

let n = 0
const base = (over: Partial<Payment>): Payment => ({
  id: `p${++n}`,
  appointmentId: "tu1",
  clientId: "c1",
  staffId: "st1",
  serviceId: "sv1",
  concept: "Corte + barba",
  kind: "servicio",
  listPrice: 20000,
  discount: 0,
  discountReason: null,
  tip: 0,
  amount: 20000,
  method: "efectivo",
  paidAt: "2026-09-27T12:00:00.000Z",
  ...over,
})

describe("historial importado del Excel: una fila representa varios cortes", () => {
  // "El martes, Sebastián, efectivo: 5 cortes, $45.000" es UNA fila que vale 5 cortes.
  const dia = base({ id: "h1", appointmentId: null, serviceId: null, listPrice: 45000, amount: 45000, units: 5, imported: true, concept: "Historial · cortes" })

  it("el ticket promedio divide por los cortes, no por las filas", () => {
    expect(summarizePayments([dia]).avgTicket).toBe(9000)
  })

  it("los servicios del barbero suman las unidades", () => {
    const [line] = staffBreakdown([dia], staff)
    expect(line.services).toBe(5)
    expect(line.revenue).toBe(45000)
  })

  it("un sello de la tarjeta de cartón ($0, importado) no cuenta como una venta del servicio", () => {
    const sello = base({ id: "s1", appointmentId: null, listPrice: 0, amount: 0, units: 0, imported: true, concept: "Historial · tarjeta de fidelidad" })
    expect(serviceBreakdown([sello], services)).toEqual([])
    expect(serviceBreakdown([sello, base({})], services)[0].count).toBe(1)
  })

  it("un cobro normal sigue valiendo un corte", () => {
    expect(summarizePayments([base({})]).avgTicket).toBe(20000)
  })
})

describe("un turno con seña: dos pagos, una sola venta", () => {
  // $8.000 de seña el día de la reserva, $12.000 el día del corte.
  const sena = base({ id: "sena", kind: "sena", method: "mercadopago", listPrice: 8000, amount: 8000, externalRef: "mp-1", paidAt: "2026-09-20T10:00:00.000Z" })
  const resto = base({ id: "resto", kind: "servicio", method: "efectivo", listPrice: 12000, amount: 12000, paidAt: "2026-09-27T12:00:00.000Z" })
  const payments = [sena, resto]

  it("summarizePayments: la seña cuenta como plata que entró, y el ticket promedio da el precio completo del corte (no lo infla contándolo dos veces)", () => {
    const money = summarizePayments(payments)
    expect(money.services).toBe(20000) // seña + resto: toda la plata real
    expect(money.avgTicket).toBe(20000) // un solo corte terminado, a su precio completo
    expect(money.count).toBe(2) // dos movimientos de caja (dos días distintos)
  })

  it("staffBreakdown: la comisión se calcula sobre el precio completo, sume la seña o no ese día", () => {
    const [line] = staffBreakdown(payments, staff)
    expect(line.services).toBe(1) // un solo corte terminado
    expect(line.revenue).toBe(20000)
    expect(line.payout).toBe(10000) // 50% de 20.000
  })

  it("staffBreakdown de un solo día no duplica: la seña ya se liquidó el día que se cobró", () => {
    const [line] = staffBreakdown([resto], staff) // el día del corte, sin la seña (se pagó otro día)
    expect(line.revenue).toBe(12000)
  })

  it("serviceBreakdown: la seña no cuenta como una venta aparte del mismo servicio", () => {
    const [row] = serviceBreakdown(payments, services)
    expect(row.count).toBe(1)
    expect(row.revenue).toBe(12000) // el kind "sena" se excluye a propósito de este conteo
  })

  it("sourceBreakdown: tampoco duplica el turno por canal", () => {
    const appt: Appointment = {
      id: "tu1", clientId: "c1", staffId: "st1", serviceId: "sv1",
      startsAt: "2026-09-27T12:00:00.000Z", endsAt: "2026-09-27T13:00:00.000Z",
      status: "completado", source: "web", price: 20000, notes: null, conversationId: null, holdExpiresAt: null, createdAt: "",
    }
    const out = sourceBreakdown(payments, [appt])
    expect(out.web.count).toBe(1)
    expect(out.web.revenue).toBe(12000)
  })
})
