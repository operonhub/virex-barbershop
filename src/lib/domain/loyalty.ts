import { BRAND } from "@/config/brand"
import type { Payment, Service } from "./types"

/**
 * Tarjeta de fidelidad digital.
 *
 * Replica la tarjeta física que Virex ya entrega (casilleros "Corte 1" a
 * "Corte 5" y el sexto al −50 %). La regla vive acá y en ningún otro lado:
 * el cobro la usa para aplicar el descuento, la ficha del cliente para
 * dibujar la tarjeta y el agente para contestar "¿cuántos me faltan?".
 *
 * El estado NO se guarda: se deriva de los pagos. Así no hay un contador que
 * se desincronice si se anula un cobro.
 */

export interface LoyaltyStatus {
  /** Sellos del ciclo actual (0 … stampsRequired). */
  stamps: number
  required: number
  /** El próximo corte que cuente va con descuento. */
  rewardReady: boolean
  rewardsRedeemed: number
  /** Fechas de los sellos del ciclo actual, para dibujar la tarjeta. */
  stampDates: string[]
}

export function loyaltyStatus(
  clientId: string,
  payments: Payment[],
  services: Service[]
): LoyaltyStatus {
  const required = BRAND.loyalty.stampsRequired
  const counts = new Set(services.filter((s) => s.countsForLoyalty).map((s) => s.id))

  let stampDates: string[] = []
  let rewardsRedeemed = 0

  const history = payments
    // Sólo el cobro del corte terminado suma sello: una seña es un adelanto,
    // no el corte en sí (si no, un turno con seña sellaría dos veces).
    .filter((p) => p.clientId === clientId && p.kind === "servicio" && p.serviceId && counts.has(p.serviceId))
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))

  for (const p of history) {
    if (p.discountReason === "fidelidad") {
      // El corte premiado cierra el ciclo y no suma sello.
      rewardsRedeemed++
      stampDates = []
    } else if (stampDates.length < required) {
      stampDates.push(p.paidAt)
    }
  }

  return {
    stamps: stampDates.length,
    required,
    rewardReady: stampDates.length >= required,
    rewardsRedeemed,
    stampDates,
  }
}

/** Descuento a aplicar al cobrar este servicio a este cliente. */
export function loyaltyDiscount(status: LoyaltyStatus, service: Service): number {
  if (!status.rewardReady || !service.countsForLoyalty) return 0
  return Math.round((service.price * BRAND.loyalty.rewardDiscountPct) / 100)
}

/**
 * El sello que se puede sacar a mano: el último del ciclo actual que sea de $0 importado o cargado a
 * mano (tarjeta de cartón, corrección). Los sellos de cortes cobrados no se tocan desde la tarjeta:
 * para eso se anula el cobro. `null` si no hay ninguno.
 */
export function removableStamp(clientId: string, payments: Payment[], services: Service[]): string | null {
  const status = loyaltyStatus(clientId, payments, services)
  if (!status.stamps) return null
  const counts = new Set(services.filter((s) => s.countsForLoyalty).map((s) => s.id))
  const cycleStart = status.stampDates[0]
  const candidate = payments
    .filter(
      (p) =>
        p.clientId === clientId &&
        p.kind === "servicio" &&
        p.imported &&
        p.amount === 0 &&
        !!p.serviceId &&
        counts.has(p.serviceId) &&
        p.discountReason !== "fidelidad" &&
        p.paidAt >= cycleStart
    )
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0]
  return candidate?.id ?? null
}
