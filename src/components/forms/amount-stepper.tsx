"use client"

import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const STEP = 1000
const MAX = 1_000_000

/**
 * Monto que se arma de a $1.000 (propina, bebida): "−" y "+" suman o restan
 * mil sin tope, y el número del medio se puede tocar para escribir otro valor
 * ($1.500, $3.500).
 */
export function AmountStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const clamp = (n: number) => Math.min(MAX, Math.max(0, Math.round(n)))
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium text-ivory">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Restar mil a ${label.toLowerCase()}`}
          disabled={value <= 0}
          onClick={() => onChange(clamp(value - STEP))}
          className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-ivory-2 transition-colors hover:border-line-strong disabled:opacity-35"
        >
          <Minus className="size-4" />
        </button>
        <div className={cn("flex h-9 w-28 items-center rounded-lg border bg-surface-2 px-2.5", value > 0 ? "border-gold" : "border-line")}>
          <span className="num text-[13px] text-ivory-3">$</span>
          <input
            aria-label={label}
            inputMode="numeric"
            value={value === 0 ? "" : new Intl.NumberFormat("es-AR").format(value)}
            placeholder="0"
            onChange={(e) => onChange(clamp(Number(e.target.value.replace(/\D/g, "")) || 0))}
            className="num w-full min-w-0 bg-transparent pl-1 text-right text-[14px] font-medium text-ivory placeholder:text-ivory-3 focus:outline-none"
          />
        </div>
        <button
          type="button"
          aria-label={`Sumar mil a ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value + STEP))}
          className="grid size-9 place-items-center rounded-lg border border-line bg-surface-2 text-ivory-2 transition-colors hover:border-line-strong"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}
