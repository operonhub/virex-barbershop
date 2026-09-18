"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Banknote, CreditCard, Landmark, QrCode, Sparkles, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { chargeAppointment } from "@/lib/data/actions"
import { formatARS, METHOD_LABEL, METHODS } from "@/lib/money"
import { hm } from "@/lib/time"
import { cn } from "@/lib/utils"
import { BRAND } from "@/config/brand"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Appointment, Client, PaymentMethod, Service, Staff } from "@/lib/domain/types"

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercadopago: QrCode,
  debito: CreditCard,
  credito: Wallet,
}

const TIPS = [0, 1000, 2000, 3000]

/**
 * Cobrar un turno en tres toques: medio de pago, propina, cobrar.
 *
 * Si el cliente tiene la tarjeta completa, el 50 % aparece YA aplicado — es
 * lo que más se olvida en la barbería cuando la tarjeta es de cartón. El
 * monto final lo recalcula el servidor con la misma regla (ver
 * `chargeAppointment`), esto es sólo la vista previa.
 */
export function ChargeDialog({
  appointment,
  client,
  service,
  staff,
  loyalty,
  open,
  onOpenChange,
}: {
  appointment: Appointment
  client: Client | undefined
  service: Service
  staff: Staff | undefined
  loyalty: LoyaltyStatus | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rewardAvailable = !!loyalty?.rewardReady && service.countsForLoyalty
  const [useReward, setUseReward] = useState(rewardAvailable)
  const [method, setMethod] = useState<PaymentMethod>("efectivo")
  const [tip, setTip] = useState(0)
  const [pending, startTransition] = useTransition()

  const discount = useReward && rewardAvailable ? Math.round((service.price * BRAND.loyalty.rewardDiscountPct) / 100) : 0
  const total = service.price - discount + tip
  const stampsAfter = service.countsForLoyalty && !(useReward && rewardAvailable) ? Math.min((loyalty?.stamps ?? 0) + 1, BRAND.loyalty.stampsRequired) : 0

  function submit() {
    startTransition(async () => {
      const res = await chargeAppointment({ appointmentId: appointment.id, method, tip, useReward })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Cobrado ${formatARS(res.data!.amount)} · ${METHOD_LABEL[method]}`, {
        description:
          stampsAfter > 0
            ? `${client?.name.split(" ")[0]} suma un sello: ${stampsAfter} de ${BRAND.loyalty.stampsRequired}.`
            : res.data!.discount > 0
              ? "Se aplicó el 50% de la tarjeta de fidelidad. Arranca una tarjeta nueva."
              : undefined,
      })
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-display text-[20px]">Cobrar</DialogTitle>
          <DialogDescription className="text-ivory-3">
            {client?.name} · {service.name} · {hm(appointment.startsAt)} con {staff?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-5">
          {rewardAvailable && (
            <button
              type="button"
              onClick={() => setUseReward((v) => !v)}
              aria-pressed={useReward}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                useReward ? "border-gold bg-gold/10" : "border-line bg-surface-2"
              )}
            >
              <Sparkles className="size-5 shrink-0 text-gold" />
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-ivory">Tarjeta completa: 50% de descuento</span>
                <span className="block text-[12px] text-ivory-3">
                  {BRAND.loyalty.stampsRequired} cortes sellados. {useReward ? "Aplicado." : "Tocá para aplicarlo."}
                </span>
              </span>
            </button>
          )}

          <section>
            <h3 className="eyebrow mb-2">Medio de pago</h3>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => {
                const Icon = METHOD_ICON[m]
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-[12px] font-medium transition-colors",
                      method === m ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
                    )}
                  >
                    <Icon className={cn("size-5", method === m ? "text-gold" : "text-ivory-3")} strokeWidth={1.75} />
                    {METHOD_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="eyebrow mb-2">Propina</h3>
            <div className="flex gap-2">
              {TIPS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTip(t)}
                  aria-pressed={tip === t}
                  className={cn(
                    "num h-9 flex-1 rounded-lg border text-[13px] font-medium transition-colors",
                    tip === t ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
                  )}
                >
                  {t === 0 ? "Sin propina" : formatARS(t)}
                </button>
              ))}
            </div>
          </section>

          <dl className="space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
            <div className="flex justify-between text-ivory-2">
              <dt>{service.name}</dt>
              <dd className="num">{formatARS(service.price)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-gold">
                <dt>Fidelidad −50%</dt>
                <dd className="num">−{formatARS(discount)}</dd>
              </div>
            )}
            {tip > 0 && (
              <div className="flex justify-between text-ivory-2">
                <dt>Propina para {staff?.name}</dt>
                <dd className="num">{formatARS(tip)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-medium text-ivory">Total</dt>
              <dd className="num font-wide text-[22px] font-semibold text-ivory">{formatARS(total)}</dd>
            </div>
          </dl>
        </div>

        <div className="border-t border-line px-6 py-4">
          <Button size="lg" onClick={submit} disabled={pending} className="h-11 w-full text-[15px] font-semibold">
            Cobrar {formatARS(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
