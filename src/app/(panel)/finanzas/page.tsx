import Link from "next/link"
import { Bot, ChevronLeft, ChevronRight } from "lucide-react"
import { Delta, PageBody, PageHeader, Panel } from "@/components/shell/page-header"
import { CumulativeChart, WeekdayChart } from "@/components/finance/charts"
import { DATA_GOLD } from "@/lib/chart-palette"
import { SOURCE_LABEL } from "@/components/agenda/status"
import { getFinanzas } from "@/lib/data/queries"
import { now } from "@/lib/data/repo"
import { delta, formatARS, formatNumber, METHOD_LABEL, METHODS, pct } from "@/lib/money"
import { addMonths, dayKey, formatMonth, monthKey, WEEKDAY_SHORT, weekday } from "@/lib/time"
import { isOpen } from "@/lib/domain/slots"
import type { AppointmentSource, ExpenseCategory } from "@/lib/domain/types"

export const metadata = { title: "Finanzas" }

const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  alquiler: "Alquiler",
  servicios: "Luz, gas e internet",
  insumos: "Insumos y productos",
  sueldos: "Sueldos",
  marketing: "Publicidad",
  otros: "Otros",
}

/**
 * FINANZAS — el mes. Un solo número héroe (ingresos) con su gráfico de
 * acumulado contra el mes anterior; el resto son desgloses para decidir:
 * quién rinde, qué servicio deja más, y cuánto trae el agente.
 */
export default async function FinanzasPage({ searchParams }: PageProps<"/finanzas">) {
  const params = await searchParams
  const current = monthKey(dayKey(await now()))
  const month = typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes) && params.mes <= current ? params.mes : current
  const d = await getFinanzas(month)

  const deltaRevenue = d.isCurrent ? delta(d.money.gross, d.moneyPrevSpan.gross) : delta(d.money.gross, d.moneyPrev.gross)

  const cumulative = cumulate(d.daily)

  const byWeekday = new Map<number, number[]>()
  for (const row of d.daily) {
    if (row.future || !isOpen(row.day)) continue
    const wd = weekday(row.day)
    byWeekday.set(wd, [...(byWeekday.get(wd) ?? []), row.total])
  }
  const weekdayData = [2, 3, 4, 5, 6].map((wd) => {
    const values = byWeekday.get(wd) ?? []
    return { label: WEEKDAY_SHORT[wd], avg: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 }
  })

  const sources = Object.entries(d.sources) as [AppointmentSource, { count: number; revenue: number }][]
  const sourceTotal = sources.reduce((s, [, v]) => s + v.revenue, 0)
  const agentShare = pct(d.sources.agente.revenue, sourceTotal)
  const maxStaff = Math.max(...d.staffLines.map((l) => l.revenue), 1)
  const maxService = Math.max(...d.serviceLines.map((l) => l.revenue), 1)
  const expenseRows = (Object.entries(d.expensesByCategory) as [ExpenseCategory, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <PageBody>
      <PageHeader
        eyebrow="Finanzas"
        title={<span className="inline-block first-letter:uppercase">{formatMonth(month)}</span>}
        description={d.isCurrent ? "Mes en curso. Las comparaciones son contra los mismos días del mes anterior." : "Mes cerrado."}
        actions={
          <div className="flex items-center rounded-lg border border-line-strong">
            <Link href={`/finanzas?mes=${addMonths(month, -1)}`} aria-label="Mes anterior" className="grid size-10 place-items-center text-ivory-2 hover:text-ivory">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href="/finanzas" className="h-10 border-x border-line-strong px-3 text-[13px] leading-10 font-medium text-ivory">
              Este mes
            </Link>
            {d.isCurrent ? (
              <span className="grid size-10 place-items-center text-ivory-3/40">
                <ChevronRight className="size-4" />
              </span>
            ) : (
              <Link href={`/finanzas?mes=${addMonths(month, 1)}`} aria-label="Mes siguiente" className="grid size-10 place-items-center text-ivory-2 hover:text-ivory">
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        }
      />

      {/* Héroe: ingresos del mes + acumulado vs mes anterior */}
      <section className="panel mt-8 grid gap-6 p-5 sm:p-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col">
          <p className="eyebrow">Ingresos del mes</p>
          <p className="mt-2 flex items-baseline gap-1.5 text-ivory">
            <span className="font-wide text-[24px] text-ivory-2">$</span>
            <span className="font-wide text-[48px] leading-none font-semibold tracking-tight">{formatNumber(d.money.gross)}</span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-[12.5px] text-ivory-3">
            <Delta value={deltaRevenue} />
            <span>vs {d.isCurrent ? "los mismos días del mes pasado" : "el mes anterior"}</span>
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-5 xl:mt-auto">
            <Figure label="Gastos" value={formatARS(d.expensesTotal)} />
            <Figure label="Resultado" value={formatARS(d.net)} tone={d.net >= 0 ? "ok" : "danger"} />
            <Figure label="Ticket promedio" value={formatARS(d.money.avgTicket)} />
            <Figure label="Propinas" value={formatARS(d.money.tips)} />
          </dl>
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[13.5px] font-semibold text-ivory font-wide">Acumulado del mes</p>
          <CumulativeChart data={cumulative} />
        </div>
      </section>

      {/* Operación del mes: tira de indicadores, no tarjetas repetidas */}
      <section className="panel mt-5 grid grid-cols-2 sm:grid-cols-4">
        <Strip label="Turnos atendidos" value={formatNumber(d.completed)} sub={d.isCurrent ? "en lo que va del mes" : `${d.completedPrev} el mes anterior`} />
        <Strip label="Ocupación" value={`${d.occupancy}%`} sub={`${d.occupancyPrev}% el mes anterior`} />
        <Strip label="No vinieron" value={`${d.noShow}%`} sub="de los turnos cerrados" />
        <Strip label="Premios de fidelidad" value={formatNumber(d.loyaltyRedeemed)} sub="cortes al 50% entregados" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* El número que justifica el agente */}
        <Panel title="De dónde vienen los turnos">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
            <Bot className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.75} />
            <p className="text-[13.5px] text-ivory-2">
              Los turnos que tomó el <b className="font-semibold text-ivory">agente IA</b> facturaron{" "}
              <b className="num font-semibold text-ivory">{formatARS(d.sources.agente.revenue)}</b> este mes —{" "}
              <span className="num">{agentShare}%</span> de lo atendido con turno, sin que nadie del equipo agarre el celular.
            </p>
          </div>
          <BarList
            rows={sources.map(([k, v]) => ({ label: SOURCE_LABEL[k], value: v.revenue, detail: `${v.count} turnos` }))}
            max={Math.max(...sources.map(([, v]) => v.revenue), 1)}
          />
        </Panel>

        <Panel title="Por día de la semana">
          <p className="mb-2 text-[12.5px] text-ivory-3">Promedio facturado por día abierto en el mes.</p>
          <WeekdayChart data={weekdayData} />
        </Panel>

        <Panel title="Por barbero">
          <BarList
            rows={d.staffLines.map((l) => ({
              label: l.staff.name,
              value: l.revenue,
              detail: `${l.services} servicios${l.staff.commissionPct ? ` · le corresponden ${formatARS(l.payout)}` : " · dueño"}`,
            }))}
            max={maxStaff}
          />
        </Panel>

        <Panel title="Por servicio">
          <BarList
            rows={d.serviceLines.map((l) => ({ label: l.service.name, value: l.revenue, detail: `${l.count} veces` }))}
            max={maxService}
          />
        </Panel>

        <Panel title="Medios de pago">
          <BarList
            rows={METHODS.map((m) => ({ label: METHOD_LABEL[m], value: d.money.byMethod[m], detail: `${pct(d.money.byMethod[m], d.money.gross)}%` }))}
            max={Math.max(...METHODS.map((m) => d.money.byMethod[m]), 1)}
          />
        </Panel>

        <Panel title="Gastos" action={<span className="num text-[12px] text-ivory-3">{formatARS(d.expensesPrevTotal)} el mes anterior</span>}>
          <BarList rows={expenseRows.map(([k, v]) => ({ label: EXPENSE_LABEL[k], value: v }))} max={Math.max(...expenseRows.map(([, v]) => v), 1)} />
        </Panel>
      </div>
    </PageBody>
  )
}

/** Totales acumulados día a día (este mes se corta en hoy; el anterior sigue completo). */
function cumulate(daily: { total: number; prev: number; future: boolean }[]) {
  let acc = 0
  let accPrev = 0
  return daily.map((row, i) => {
    acc += row.total
    accPrev += row.prev
    return { day: i + 1, current: row.future ? null : acc, previous: accPrev }
  })
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div>
      <dt className="eyebrow text-[10px]">{label}</dt>
      <dd className={`num mt-1 text-[16px] font-semibold ${tone === "danger" ? "text-danger" : "text-ivory"}`}>{value}</dd>
    </div>
  )
}

function Strip({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-line px-5 py-4 not-first:border-l max-sm:nth-[3]:border-l-0 max-sm:nth-[n+3]:border-t sm:py-5">
      <p className="eyebrow truncate">{label}</p>
      <p className="num mt-2 font-wide text-[24px] leading-none font-semibold text-ivory">{value}</p>
      <p className="mt-1.5 text-[12px] text-ivory-3">{sub}</p>
    </div>
  )
}

/** Barras horizontales en HTML: un solo tono (magnitud), el valor en texto al final. */
function BarList({ rows, max }: { rows: { label: string; value: number; detail?: string }[]; max: number }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-ivory">{r.label}</span>
            <span className="num text-ivory">
              {formatARS(r.value)}
              {r.detail && <span className="ml-2 text-[12px] text-ivory-3">{r.detail}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1, (r.value / max) * 100)}%`, background: DATA_GOLD }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
