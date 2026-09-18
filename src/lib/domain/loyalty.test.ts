import { describe, expect, it } from "vitest"
import { loyaltyDiscount, loyaltyStatus } from "./loyalty"
import type { Payment, Service } from "./types"

const services: Service[] = [
  { id: "corte", name: "Corte", category: "corte", durationMin: 40, price: 14000, countsForLoyalty: true, active: true },
  { id: "barba", name: "Barba", category: "barba", durationMin: 25, price: 8000, countsForLoyalty: false, active: true },
]
let n = 0
const pay = (serviceId: string, reward = false): Payment => ({
  id: `p${++n}`, appointmentId: null, clientId: "c1", staffId: null, serviceId, concept: "", kind: "servicio",
  listPrice: 0, discount: 0, discountReason: reward ? "fidelidad" : null, tip: 0, amount: 0, method: "efectivo",
  paidAt: new Date(Date.UTC(2026, 8, n)).toISOString(),
})

describe("tarjeta de fidelidad (5 cortes → el 6to al 50%)", () => {
  it("sólo suman sello los servicios con corte", () => {
    const st = loyaltyStatus("c1", [pay("corte"), pay("barba"), pay("corte")], services)
    expect(st.stamps).toBe(2)
    expect(st.rewardReady).toBe(false)
  })

  it("con 5 sellos, el próximo corte va al 50%", () => {
    const st = loyaltyStatus("c1", Array.from({ length: 5 }, () => pay("corte")), services)
    expect(st.rewardReady).toBe(true)
    expect(loyaltyDiscount(st, services[0])).toBe(7000)
    expect(loyaltyDiscount(st, services[1])).toBe(0) // la barba no se descuenta
  })

  it("el corte premiado no suma sello y arranca una tarjeta nueva", () => {
    const history = [...Array.from({ length: 5 }, () => pay("corte")), pay("corte", true), pay("corte")]
    const st = loyaltyStatus("c1", history, services)
    expect(st.stamps).toBe(1)
    expect(st.rewardsRedeemed).toBe(1)
  })
})
