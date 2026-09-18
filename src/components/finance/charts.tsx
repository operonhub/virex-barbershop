"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { formatARS, formatCompact } from "@/lib/money"

import { DATA_GOLD, DATA_STEEL } from "@/lib/chart-palette"

// Texto de ejes y etiquetas: siempre tokens de texto, nunca el color de la serie.
const GRID = "rgb(242 237 227 / 0.07)"
const AXIS = "#8f887b"

const cumulativeConfig = {
  current: { label: "Este mes", color: DATA_GOLD },
  previous: { label: "Mes anterior", color: DATA_STEEL },
} satisfies ChartConfig

/**
 * "¿Voy mejor que el mes pasado?": lo acumulado día a día, este mes contra
 * el anterior. Una sola escala (los dos son pesos), así que un solo eje.
 */
export function CumulativeChart({
  data,
}: {
  data: { day: number; current: number | null; previous: number }[]
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-ivory-2">
        <Legend color={DATA_GOLD} label="Este mes" />
        <Legend color={DATA_STEEL} label="Mes anterior" />
      </div>
      <ChartContainer config={cumulativeConfig} className="aspect-auto h-[240px] w-full">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DATA_GOLD} stopOpacity={0.18} />
              <stop offset="100%" stopColor={DATA_GOLD} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} interval={4} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <ChartTooltip
            cursor={{ stroke: "rgb(242 237 227 / 0.25)", strokeWidth: 1 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, p) => `Día ${p?.[0]?.payload?.day}`}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-4">
                    <span className="text-ivory-2">{cumulativeConfig[name as keyof typeof cumulativeConfig]?.label}</span>
                    <span className="num font-medium text-ivory">{formatARS(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <Line
            dataKey="previous"
            type="monotone"
            stroke={DATA_STEEL}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#131210", strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Area
            dataKey="current"
            type="monotone"
            stroke={DATA_GOLD}
            strokeWidth={2}
            fill="url(#fill-current)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4, stroke: "#131210", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

const weekdayConfig = { avg: { label: "Promedio", color: DATA_GOLD } } satisfies ChartConfig

/** Promedio por día de la semana: dónde conviene una promo (los martes flojos). */
export function WeekdayChart({ data }: { data: { label: string; avg: number }[] }) {
  return (
    <ChartContainer config={weekdayConfig} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip
          cursor={{ fill: "rgb(242 237 227 / 0.04)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => <span className="num font-medium text-ivory">{formatARS(Number(value))} por día</span>}
            />
          }
        />
        <Bar
          dataKey="avg"
          fill={DATA_GOLD}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
          label={{ position: "top", fill: "#bdb5a6", fontSize: 11, formatter: (v: unknown) => formatCompact(Number(v)) }}
        />
      </BarChart>
    </ChartContainer>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
