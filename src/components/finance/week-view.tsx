import { Panel } from "@/components/shell/page-header"
import { formatARS, formatNumber } from "@/lib/money"
import { dayKey, formatDayShort } from "@/lib/time"
import { cn } from "@/lib/utils"
import type { WeekClosing } from "@/lib/domain/finance"
import type { Expense, Staff } from "@/lib/domain/types"

/**
 * El cierre de la semana, como la hoja de Excel de la barbería pero hecho
 * solo: por persona (cortes, comisión, propinas, vales, lo que falta pagar),
 * lo que le queda a la casa y el día por día.
 */
export function WeekView({ d, expenses, staff, today }: { d: WeekClosing; expenses: Expense[]; staff: Staff[]; today: string }) {
  const activeDays = d.days.filter((x) => x.income > 0 || x.expenses > 0 || x.day <= today)
  const vales = expenses.filter((e) => e.category === "vale" || (e.category === "sueldos" && e.staffId))
  const nameOf = (id?: string | null) => staff.find((m) => m.id === id)?.name ?? "—"

  return (
    <>
      <section className="panel mt-8 grid gap-6 p-5 sm:p-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col">
          <p className="eyebrow">Facturado en la semana</p>
          <p className="mt-2 flex items-baseline gap-1.5 text-ivory">
            <span className="font-wide text-[24px] text-ivory-2">$</span>
            <span className="font-wide text-[48px] leading-none font-semibold tracking-tight">{formatNumber(d.income)}</span>
          </p>
          <p className="mt-3 text-[12.5px] text-ivory-3">Cortes, productos, bebidas y propinas.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-5 sm:grid-cols-4 xl:border-t-0 xl:pt-0">
          <Figure label="Sueldos y propinas" value={formatARS(d.payroll)} hint="comisión de los barberos" />
          <Figure label="Gastos del local" value={formatARS(d.operatingExpenses)} hint="sin vales ni sueldos" />
          <Figure label="Bebidas y productos" value={formatARS(d.products)} hint="son de la casa" />
          <Figure label="Le queda a la casa" value={formatARS(d.result)} tone={d.result >= 0 ? "ok" : "danger"} hint="ingresos − sueldos − gastos" />
        </dl>
      </section>

      <div className="mt-5">
        <Panel title="Cierre por persona" bodyClassName="px-0 pb-1">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="eyebrow text-left">
                  <th className="px-5 py-2 font-medium">Barbero</th>
                  <th className="px-2 py-2 text-right font-medium">Cortes</th>
                  <th className="px-2 py-2 text-right font-medium">Facturó</th>
                  <th className="px-2 py-2 text-right font-medium">Comisión</th>
                  <th className="px-2 py-2 text-right font-medium">Propinas</th>
                  <th className="px-2 py-2 text-right font-medium">Vales</th>
                  <th className="px-2 py-2 text-right font-medium">Pagado</th>
                  <th className="px-5 py-2 text-right font-medium">A pagar</th>
                </tr>
              </thead>
              <tbody>
                {d.staffLines.map((l) => {
                  const owner = l.staff.commissionPct === 0
                  return (
                    <tr key={l.staff.id} className="border-t border-line">
                      <td className="px-5 py-3 font-medium text-ivory">
                        {l.staff.name}
                        {owner && <span className="ml-2 text-[11px] font-normal text-ivory-3">dueño</span>}
                      </td>
                      <td className="num px-2 py-3 text-right text-ivory-2">{l.services}</td>
                      <td className="num px-2 py-3 text-right text-ivory">{formatARS(l.revenue)}</td>
                      <td className="num px-2 py-3 text-right text-ivory-2">{owner ? "—" : formatARS(l.commission)}</td>
                      <td className="num px-2 py-3 text-right text-ivory-2">{formatARS(l.tips)}</td>
                      <td className="num px-2 py-3 text-right text-ivory-2">{l.advances ? `−${formatARS(l.advances)}` : "—"}</td>
                      <td className="num px-2 py-3 text-right text-ivory-2">{l.paid ? `−${formatARS(l.paid)}` : "—"}</td>
                      <td className={cn("num px-5 py-3 text-right font-semibold", owner ? "text-ivory-3" : l.balance < 0 ? "text-danger" : "text-ivory")}>
                        {owner ? "—" : formatARS(l.balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 pt-3 pb-3 text-[12px] text-ivory-3">
            A pagar = comisión + propinas − vales − pagos ya hechos. Los dueños no cobran comisión: lo que facturan queda en la casa
            {d.ownerAdvances > 0 && <>, y sus vales de esta semana ({formatARS(d.ownerAdvances)}) son retiros</>}.
          </p>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Día por día" bodyClassName="px-0 pb-1">
          <ul>
            {activeDays.map((x) => (
              <li key={x.day} className="flex items-baseline justify-between gap-3 border-t border-line px-5 py-2.5 text-[13px] first:border-0">
                <span className="text-ivory first-letter:uppercase">{formatDayShort(x.day)}</span>
                <span className="num text-ivory">
                  {formatARS(x.income)}
                  {x.expenses > 0 && <span className="ml-2 text-[12px] text-ivory-3">−{formatARS(x.expenses)} gastos</span>}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Vales y pagos" bodyClassName="px-0 pb-1">
          {vales.length === 0 ? (
            <p className="px-5 pb-4 text-[13px] text-ivory-3">Sin vales ni pagos esta semana.</p>
          ) : (
            <ul>
              {vales.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-t border-line px-5 py-2.5 text-[13px] first:border-0">
                  <span className="text-ivory-2">
                    <span className="text-ivory">{nameOf(e.staffId)}</span> · {e.category === "vale" ? "vale" : "pago"}
                    <span className="ml-2 text-[12px] text-ivory-3">{formatDayShort(dayKey(e.paidAt))}</span>
                  </span>
                  <span className="num text-ivory">−{formatARS(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "ok" | "danger" }) {
  return (
    <div>
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={cn("num mt-1 text-[18px] font-semibold", tone === "danger" ? "text-danger" : "text-ivory")}>{value}</dd>
      <p className="mt-0.5 text-[11.5px] text-ivory-3">{hint}</p>
    </div>
  )
}
