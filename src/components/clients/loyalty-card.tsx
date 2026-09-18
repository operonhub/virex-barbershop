"use client"

import { GlareHover } from "@/components/ui/glare-hover"
import { VirexMark } from "@/components/brand/virex-mark"
import { BRAND } from "@/config/brand"
import { cn } from "@/lib/utils"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
})

/**
 * La tarjeta de fidelidad de Virex, pasada a digital.
 *
 * Es una réplica de la tarjeta física que ya entregan (fondo negro, doble
 * filete dorado, el emblema al centro, "Corte 1 … Corte 5" y el sexto
 * casillero al −50 %): el cliente la reconoce al instante, y el dueño no
 * tiene que explicar nada nuevo. El brillo al pasar el mouse la hace sentir
 * objeto — es el único lugar de la app con ese efecto.
 */
export function LoyaltyCard({ status, clientName }: { status: LoyaltyStatus; clientName: string }) {
  const boxes = Array.from({ length: status.required }, (_, i) => status.stampDates[i] ?? null)

  return (
    <GlareHover
      width="100%"
      background="#0b0a09"
      color="#fff3c9"
      opacity={0.22}
      angle={-35}
      duration={900}
      className="aspect-[1.6] w-full max-w-[420px] rounded-2xl shadow-[0_24px_48px_-24px_rgb(0_0_0/0.9)]"
    >
      <div className="absolute inset-3 rounded-lg border border-gold/50" />
      <div className="absolute inset-[18px] rounded-md border border-gold/20" />
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 px-6 py-5">
        <VirexMark size={40} />
        <p className="flex w-full items-center gap-2 text-[10px] font-semibold tracking-[0.3em] text-gold font-wide">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
          TARJETA DE FIDELIDAD
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
        </p>
        <div className="mt-1 grid w-full grid-cols-6 gap-1.5">
          {boxes.map((date, i) => (
            <Box key={i} label={`Corte ${i + 1}`} stamped={!!date} sub={date ? dateFmt.format(new Date(date)) : undefined} />
          ))}
          <Box label="Corte 6" reward ready={status.rewardReady} />
        </div>
        <p className="mt-1 truncate text-[11px] text-ivory-3">
          {clientName} · {status.rewardReady ? "¡el próximo corte va al 50%!" : `${status.required - status.stamps} para el premio`}
        </p>
      </div>
    </GlareHover>
  )
}

function Box({
  label,
  stamped,
  sub,
  reward,
  ready,
}: {
  label: string
  stamped?: boolean
  sub?: string
  reward?: boolean
  ready?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "grid aspect-square w-full place-items-center rounded-[4px] border",
          reward
            ? ready
              ? "border-gold bg-gold/15 text-gold-bright"
              : "border-gold/70 text-gold"
            : stamped
              ? "border-gold/60 bg-gold/10"
              : "border-gold/35"
        )}
      >
        {reward ? (
          <span className="text-[10.5px] font-bold tracking-tight sm:text-[12px]">−{BRAND.loyalty.rewardDiscountPct}%</span>
        ) : stamped ? (
          <VirexMark size={20} className="opacity-90" title="Sellado" />
        ) : null}
      </div>
      <span className="text-[8.5px] leading-none text-ivory-3">{sub ?? label}</span>
    </div>
  )
}

/** Versión compacta para listas y la ficha lateral de la bandeja. */
export function LoyaltyStamps({ status }: { status: LoyaltyStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: status.required }, (_, i) => (
        <span
          key={i}
          className={cn("size-3.5 rounded-full border", i < status.stamps ? "border-gold bg-gold" : "border-gold/35")}
        />
      ))}
      <span
        className={cn(
          "ml-1 rounded-full px-1.5 text-[10.5px] font-semibold font-wide",
          status.rewardReady ? "bg-gold text-obsidian" : "text-ivory-3"
        )}
      >
        −{BRAND.loyalty.rewardDiscountPct}%
      </span>
    </div>
  )
}
