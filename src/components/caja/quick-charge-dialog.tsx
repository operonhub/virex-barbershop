"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Banknote, CreditCard, Landmark, QrCode, Search, Sparkles, UserPlus, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { quickCharge } from "@/lib/data/actions"
import { formatARS, METHOD_LABEL, METHODS } from "@/lib/money"
import { cn } from "@/lib/utils"
import { BRAND } from "@/config/brand"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Client, PaymentMethod, Service, Staff } from "@/lib/domain/types"

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercadopago: QrCode,
  debito: CreditCard,
  credito: Wallet,
}
const TIPS = [0, 1000, 2000, 3000]

type Step = "cliente" | "cobro"

/**
 * Cobro rápido: alguien que cae sin turno. Sin esto, un corte cobrado "de
 * una" no queda en la agenda, no suma comisión ni sello, y el sistema no
 * sabe que el barbero estuvo ocupado — por eso registrar TODOS los cortes,
 * hablen o no por WhatsApp, es la regla de oro del panel.
 */
export function QuickChargeDialog({
  open,
  onOpenChange,
  staff,
  services,
  clients,
  loyalty,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: Staff[]
  services: Service[]
  clients: Client[]
  /** Ficha de fidelidad por clienteId; vacía para un cliente nuevo. */
  loyalty: Record<string, LoyaltyStatus>
}) {
  const [step, setStep] = useState<Step>("cliente")
  const [query, setQuery] = useState("")
  const [client, setClient] = useState<Client | null>(null)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [staffId, setStaffId] = useState(staff.find((s) => s.active)?.id ?? "")
  const [serviceId, setServiceId] = useState(services.find((s) => s.active)?.id ?? "")
  const [method, setMethod] = useState<PaymentMethod>("efectivo")
  const [tip, setTip] = useState(0)
  const [pending, startTransition] = useTransition()

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone?.includes(q)).slice(0, 6)
  }, [query, clients])

  const service = services.find((s) => s.id === serviceId)
  const rewardStatus = client ? loyalty[client.id] : undefined
  const rewardAvailable = !!rewardStatus?.rewardReady && !!service?.countsForLoyalty
  const [useReward, setUseReward] = useState(false)
  const discount = useReward && rewardAvailable && service ? Math.round((service.price * BRAND.loyalty.rewardDiscountPct) / 100) : 0
  const total = (service?.price ?? 0) - discount + tip

  function reset() {
    setStep("cliente")
    setQuery("")
    setClient(null)
    setNewName("")
    setNewPhone("")
    setMethod("efectivo")
    setTip(0)
    setUseReward(false)
  }

  function pickClient(c: Client | null) {
    setClient(c)
    setUseReward(false)
    setStep("cobro")
  }

  function submit() {
    if (!staffId || !serviceId) return toast.error("Elegí barbero y servicio.")
    startTransition(async () => {
      const res = await quickCharge({
        staffId,
        serviceId,
        clientId: client?.id,
        newClient: client ? undefined : { name: newName, phone: newPhone },
        method,
        tip,
        useReward: useReward && rewardAvailable,
      })
      if (!res.ok) return void toast.error(res.error)
      toast.success(`Cobrado ${formatARS(res.data!.amount)} · ${METHOD_LABEL[method]}`)
      onOpenChange(false)
      reset()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-display text-[20px]">Cobro rápido</DialogTitle>
          <DialogDescription className="text-ivory-3">Para el que cae sin turno. Queda registrado igual que si hubiera reservado.</DialogDescription>
        </DialogHeader>

        {step === "cliente" ? (
          <div className="space-y-4 px-6 pb-6">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ivory-3" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o teléfono…"
                className="h-11 w-full rounded-lg border border-line-strong bg-surface-2 pr-3 pl-9 text-[14px] text-ivory placeholder:text-ivory-3 focus:border-gold/50 focus:outline-none"
              />
            </label>
            {matches.length > 0 && (
              <ul className="-mt-2 divide-y divide-line rounded-lg border border-line">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickClient(c)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
                    >
                      <span className="text-[13.5px] text-ivory">{c.name}</span>
                      {c.phone && <span className="num text-[12px] text-ivory-3">{c.phone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-lg border border-dashed border-line-strong p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ivory-2">
                <UserPlus className="size-3.5" /> Cliente nuevo
              </p>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-[13.5px] text-ivory placeholder:text-ivory-3 focus:outline-none"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="num h-9 w-[150px] rounded-lg border border-line-strong bg-surface-2 px-3 text-[13.5px] text-ivory placeholder:text-ivory-3 focus:outline-none"
                />
              </div>
              <Button size="sm" className="mt-2 h-9 w-full" disabled={newName.trim().length < 2} onClick={() => pickClient(null)}>
                Seguir con {newName.trim() || "este cliente"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-6 pb-5">
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13.5px] text-ivory">
              {client?.name ?? newName}
              <button type="button" onClick={() => setStep("cliente")} className="ml-2 text-[12px] text-ivory-3 underline underline-offset-2">
                cambiar
              </button>
            </p>

            <section>
              <h3 className="eyebrow mb-2">Barbero</h3>
              <div className="grid grid-cols-3 gap-2">
                {staff
                  .filter((s) => s.active)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStaffId(s.id)}
                      aria-pressed={staffId === s.id}
                      className={cn(
                        "h-10 rounded-lg border text-[13px] font-medium transition-colors",
                        staffId === s.id ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            </section>

            <section>
              <h3 className="eyebrow mb-2">Servicio</h3>
              <div className="grid grid-cols-2 gap-2">
                {services
                  .filter((s) => s.active)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      aria-pressed={serviceId === s.id}
                      className={cn(
                        "flex h-12 flex-col items-center justify-center rounded-lg border text-[13px] font-medium transition-colors",
                        serviceId === s.id ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2 hover:border-line-strong"
                      )}
                    >
                      {s.name}
                      <span className="num text-[11px] font-normal text-ivory-3">{formatARS(s.price)}</span>
                    </button>
                  ))}
              </div>
            </section>

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
                  <span className="block text-[12px] text-ivory-3">{useReward ? "Aplicado." : "Tocá para aplicarlo."}</span>
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

            <div className="border-t border-line pt-4">
              <Button size="lg" onClick={submit} disabled={pending || !service} className="h-11 w-full text-[15px] font-semibold">
                Cobrar {formatARS(total)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
