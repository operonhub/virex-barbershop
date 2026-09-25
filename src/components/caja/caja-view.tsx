"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Banknote, CreditCard, Landmark, Lock, Plus, QrCode, Sparkles, Wallet } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/shell/page-header"
import { ChargeDialog } from "./charge-dialog"
import { addExpense, closeCash } from "@/lib/data/actions"
import { formatARS, formatNumber, METHOD_LABEL, METHODS, pct } from "@/lib/money"
import { hm } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { MoneySummary, StaffLine } from "@/lib/domain/finance"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Appointment, CashClosure, Client, Expense, ExpenseCategory, Payment, PaymentMethod, Service, Staff } from "@/lib/domain/types"

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  efectivo: Banknote,
  transferencia: Landmark,
  mercadopago: QrCode,
  debito: CreditCard,
  credito: Wallet,
}

/** Tonos del mismo marfil para la barra de medios de pago: sin arco iris. */
const METHOD_SHADE: Record<PaymentMethod, string> = {
  efectivo: "bg-gold",
  transferencia: "bg-ivory-2",
  mercadopago: "bg-ivory-3",
  debito: "bg-gold-deep",
  credito: "bg-surface-3",
}

/** Fondo fijo de la caja al abrir. Se configura en Ajustes (a confirmar con Virex). */
export function CajaView({
  isToday,
  payments,
  expenses,
  money,
  staffLines,
  pending,
  staff,
  services,
  clients,
  loyalty,
  openingCash,
  day,
  closure,
}: {
  day: string
  /** Cierre ya guardado de ese día, si lo hay. */
  closure: CashClosure | null
  /** Fondo de caja (Ajustes → Local). */
  openingCash: number
  isToday: boolean
  payments: Payment[]
  expenses: Expense[]
  money: MoneySummary
  staffLines: StaffLine[]
  pending: Appointment[]
  staff: Staff[]
  services: Service[]
  clients: Client[]
  loyalty: Record<string, LoyaltyStatus>
}) {
  const [chargingId, setChargingId] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const charging = pending.find((a) => a.id === chargingId)
  const clientOf = (id: string | null) => clients.find((c) => c.id === id)
  const staffOf = (id: string | null) => staff.find((s) => s.id === id)
  const cashExpenses = expenses.filter((e) => e.method === "efectivo").reduce((s, e) => s + e.amount, 0)
  const expectedCash = openingCash + money.byMethod.efectivo - cashExpenses

  return (
    <>
      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Entró {isToday ? "hoy" : "ese día"}</p>
                <p className="mt-2 flex items-baseline gap-1.5 text-ivory">
                  <span className="font-wide text-[22px] text-ivory-2">$</span>
                  <span className="num font-wide text-[44px] leading-none font-semibold tracking-tight">{formatNumber(money.gross)}</span>
                </p>
                <p className="mt-2 text-[12.5px] text-ivory-3">
                  <span className="num">{money.count}</span> cobros · servicios <span className="num">{formatARS(money.services)}</span>
                  {money.products > 0 && (
                    <>
                      {" "}· productos <span className="num">{formatARS(money.products)}</span>
                    </>
                  )}
                  {money.tips > 0 && (
                    <>
                      {" "}· propinas <span className="num">{formatARS(money.tips)}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Efectivo en caja</p>
                <p className="num mt-2 font-wide text-[24px] font-semibold text-ivory">{formatARS(expectedCash)}</p>
                <p className="text-[12px] text-ivory-3">
                  fondo <span className="num">{formatARS(openingCash)}</span> + cobros − gastos
                </p>
              </div>
            </div>

            {/* Medios de pago: una barra, no una torta. */}
            <div className="mt-6 flex h-2.5 overflow-hidden rounded-full bg-surface-3">
              {METHODS.map((m) =>
                money.byMethod[m] > 0 ? (
                  <span key={m} className={METHOD_SHADE[m]} style={{ width: `${pct(money.byMethod[m], money.gross)}%` }} />
                ) : null
              )}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
              {METHODS.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", METHOD_SHADE[m])} />
                  <span>
                    <span className="block text-[12px] text-ivory-3">{METHOD_LABEL[m]}</span>
                    <span className="num block text-[14px] font-medium text-ivory">{formatARS(money.byMethod[m])}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Panel title="Cobros" action={<span className="num text-[12px] text-ivory-3">{payments.length}</span>} bodyClassName="px-0 pb-1">
            {payments.length === 0 ? (
              <p className="px-5 pb-4 text-[13px] text-ivory-3">Todavía no hay cobros.</p>
            ) : (
              <ul>
                {payments.map((p) => {
                  const Icon = METHOD_ICON[p.method]
                  return (
                    <li key={p.id} className="flex items-center gap-4 border-t border-line px-5 py-2.5 first:border-0">
                      <span className="num w-11 text-[13px] text-ivory-3">{hm(p.paidAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-ivory">
                          {clientOf(p.clientId)?.name ?? "Mostrador"}
                        </span>
                        <span className="flex items-center gap-2 truncate text-[12px] text-ivory-3">
                          {p.concept}
                          {p.staffId && ` · ${staffOf(p.staffId)?.name}`}
                          {p.discountReason === "fidelidad" && (
                            <span className="inline-flex items-center gap-0.5 text-gold">
                              <Sparkles className="size-3" /> 50%
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="hidden items-center gap-1.5 text-[12px] text-ivory-3 sm:flex">
                        <Icon className="size-3.5" strokeWidth={1.75} /> {METHOD_LABEL[p.method]}
                      </span>
                      <span className="num w-24 text-right text-[14px] font-medium text-ivory">
                        {formatARS(p.amount)}
                        {p.tip > 0 && <span className="block text-[11px] font-normal text-ivory-3">+{formatARS(p.tip)} propina</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          {pending.length > 0 && (
            <Panel title="Por cobrar" className="ring-1 ring-gold/25" bodyClassName="px-0 pb-1">
              <ul>
                {pending.map((a) => {
                  const reward = loyalty[a.clientId]?.rewardReady && services.find((s) => s.id === a.serviceId)?.countsForLoyalty
                  return (
                    <li key={a.id} className="border-t border-line first:border-0">
                      <button
                        type="button"
                        onClick={() => setChargingId(a.id)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 truncate text-[13.5px] font-medium text-ivory">
                            {clientOf(a.clientId)?.name}
                            {reward && <Sparkles className="size-3.5 text-gold" aria-label="Le toca el 50%" />}
                          </span>
                          <span className="block text-[12px] text-ivory-3">
                            {services.find((s) => s.id === a.serviceId)?.name} · {staffOf(a.staffId)?.name} · {hm(a.startsAt)}
                          </span>
                        </span>
                        <span className="text-[12.5px] font-semibold text-gold">Cobrar →</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          <Panel title="Por barbero" bodyClassName="px-0 pb-1">
            <ul>
              {staffLines.map((l) => (
                <li key={l.staff.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-0">
                  <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[12px] font-semibold text-ivory">
                    {l.staff.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ivory">{l.staff.name}</span>
                    <span className="num block text-[12px] text-ivory-3">
                      {l.services} servicios · {formatARS(l.revenue)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-[13.5px] font-medium text-ivory">
                      {l.staff.commissionPct > 0 ? formatARS(l.payout) : "—"}
                    </span>
                    <span className="block text-[11px] text-ivory-3">
                      {l.staff.commissionPct > 0 ? `le toca (${l.staff.commissionPct}% + propinas)` : "dueño"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Gastos del día"
            action={
              <Button variant="ghost" size="sm" onClick={() => setExpenseOpen(true)}>
                <Plus /> Cargar
              </Button>
            }
            bodyClassName="px-0 pb-1"
          >
            {expenses.length === 0 ? (
              <p className="px-5 pb-4 text-[13px] text-ivory-3">Sin gastos cargados.</p>
            ) : (
              <ul>
                {expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[13px] first:border-0">
                    <span className="text-ivory-2">{e.description}</span>
                    <span className="num text-ivory">−{formatARS(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {closure ? (
            <section className="panel px-5 py-4">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ivory font-wide">
                <Lock className="size-4 text-ivory-3" /> Caja cerrada a las {hm(closure.closedAt)}
              </p>
              <dl className="mt-2 space-y-1 text-[13px]">
                <div className="flex justify-between text-ivory-2">
                  <dt>Contado</dt>
                  <dd className="num">{formatARS(closure.countedCash)}</dd>
                </div>
                <div className="flex justify-between text-ivory-2">
                  <dt>Esperado al cerrar</dt>
                  <dd className="num">{formatARS(closure.expectedCash)}</dd>
                </div>
              </dl>
              <DiffLine diff={closure.countedCash - closure.expectedCash} className="mt-2" />
              {closure.expectedCash !== expectedCash && (
                <p className="mt-2 text-[12px] text-ivory-3">Hubo movimientos después del cierre: hoy se esperan {formatARS(expectedCash)}.</p>
              )}
              {closure.notes && <p className="mt-2 text-[12.5px] text-ivory-3">“{closure.notes}”</p>}
              <Button variant="ghost" size="sm" className="mt-2 -ml-2" onClick={() => setCloseOpen(true)}>
                Corregir el cierre
              </Button>
            </section>
          ) : (
            isToday && (
              <Button variant="outline" size="lg" className="h-11 w-full gap-2" onClick={() => setCloseOpen(true)}>
                <Lock className="size-4" /> Cerrar la caja del día
              </Button>
            )
          )}
        </aside>
      </div>

      {charging && (
        <ChargeDialog
          key={charging.id}
          open
          onOpenChange={(o) => !o && setChargingId(null)}
          appointment={charging}
          client={clientOf(charging.clientId)}
          service={services.find((s) => s.id === charging.serviceId)!}
          staff={staffOf(charging.staffId)}
          loyalty={loyalty[charging.clientId]}
        />
      )}
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      {closeOpen && <CloseDialog onClose={() => setCloseOpen(false)} day={day} expected={expectedCash} money={money} previous={closure} />}
    </>
  )
}

const CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: "insumos", label: "Insumos" },
  { id: "servicios", label: "Servicios" },
  { id: "alquiler", label: "Alquiler" },
  { id: "sueldos", label: "Sueldos" },
  { id: "marketing", label: "Publicidad" },
  { id: "otros", label: "Otros" },
]

function ExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("insumos")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<PaymentMethod>("efectivo")
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await addExpense({ category, description, amount: Number(amount.replace(/\D/g, "")), method })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Gasto cargado")
      setDescription("")
      setAmount("")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">Cargar gasto</DialogTitle>
          <DialogDescription className="text-ivory-3">Lo que sale de la caja: insumos, un arreglo, la luz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={cn(
                  "h-9 rounded-lg border text-[12.5px] font-medium",
                  category === c.id ? "border-gold bg-gold/8 text-ivory" : "border-line bg-surface-2 text-ivory-2"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción (ej. hojas de afeitar)"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="Monto"
              className="num h-10 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-[14px] text-ivory placeholder:text-ivory-3 focus:outline-none"
            />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="h-10 rounded-lg border border-line-strong bg-surface-2 px-2 text-[13px] text-ivory"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <Button size="lg" className="h-10 w-full font-semibold" disabled={pending} onClick={submit}>
            Guardar gasto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Cierre de caja: se cuenta el efectivo y se compara con lo esperado.
 * Es el "fin" del día (peak-end): tiene que cerrar con una sensación de orden.
 * TODO(supabase): persistir en `cash_sessions` (ver 0001_core.sql).
 */
function DiffLine({ diff, className }: { diff: number; className?: string }) {
  return (
    <p className={cn("text-[13.5px] font-medium", diff === 0 ? "text-ok" : Math.abs(diff) < 1000 ? "text-ivory-2" : "text-danger", className)}>
      {diff === 0 ? "Cierra justo. 👌" : diff > 0 ? `Sobran ${formatARS(diff)}` : `Faltan ${formatARS(-diff)}`}
    </p>
  )
}

/**
 * Cierre de caja. Se manda sólo lo contado: el esperado lo recalcula el
 * servidor, así nadie lo acomoda para que "cierre justo". Queda guardado.
 */
function CloseDialog({
  onClose,
  day,
  expected,
  money,
  previous,
}: {
  onClose: () => void
  day: string
  expected: number
  money: MoneySummary
  previous: CashClosure | null
}) {
  const [counted, setCounted] = useState(previous ? String(previous.countedCash) : "")
  const [notes, setNotes] = useState(previous?.notes ?? "")
  const [pending, startTransition] = useTransition()
  const value = Number(counted.replace(/\D/g, ""))
  const diff = counted ? value - expected : null

  function submit() {
    startTransition(async () => {
      const res = await closeCash({ day, counted: value, notes })
      if (!res.ok) return void toast.error(res.error)
      toast.success(previous ? "Cierre corregido" : "Caja cerrada", { description: `Hoy entraron ${formatARS(money.gross)}. Buen día de trabajo.` })
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px]">{previous ? "Corregir el cierre" : "Cierre de caja"}</DialogTitle>
          <DialogDescription className="text-ivory-3">Contá el efectivo del cajón y cargalo. Queda guardado.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
          <div className="flex justify-between text-ivory-2">
            <dt>Entró en total</dt>
            <dd className="num">{formatARS(money.gross)}</dd>
          </div>
          <div className="flex justify-between text-ivory-2">
            <dt>Efectivo esperado</dt>
            <dd className="num">{formatARS(expected)}</dd>
          </div>
        </dl>
        <input
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          inputMode="numeric"
          autoFocus
          placeholder="Efectivo contado"
          className="num h-12 w-full rounded-lg border border-line-strong bg-surface-2 px-4 font-wide text-[20px] text-ivory placeholder:text-[15px] placeholder:text-ivory-3 focus:border-gold/60 focus:outline-none"
        />
        {diff !== null && <DiffLine diff={diff} />}
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota (opcional): ej. faltan $1.000 del cambio"
          className="h-10 w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[13.5px] text-ivory placeholder:text-ivory-3 focus:outline-none"
        />
        <Button size="lg" className="h-10 w-full font-semibold" disabled={!counted || pending} onClick={submit}>
          {pending ? "Guardando…" : previous ? "Guardar corrección" : "Cerrar caja"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
