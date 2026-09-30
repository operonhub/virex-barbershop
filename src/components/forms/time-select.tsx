"use client"

import { timeOptions } from "@/lib/domain/schedule"
import { cn } from "@/lib/utils"

/**
 * Selector de hora para todo el panel: de 5 en 5 minutos, dentro del horario
 * del local (o del rango que se pida). Antes los horarios sólo se podían elegir
 * "en punto" (11:00, 12:00…), y un turno de 17:15 a 18:00 o un corte de 45'
 * era imposible de cargar.
 *
 * Es un <select> nativo a propósito: en el celular abre la ruedita del
 * sistema, que se maneja con un dedo entre corte y corte.
 */
export function TimeSelect({
  value,
  onChange,
  label,
  from,
  to,
  stepMin = 5,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Para lectores de pantalla ("Desde", "Hasta"…). */
  label: string
  from?: string
  to?: string
  stepMin?: number
  className?: string
}) {
  const options = timeOptions(stepMin, from, to)
  // Un valor que no cae en la grilla (un turno viejo a las 11:07) no se pierde: se suma como opción.
  if (value && !options.includes(value)) options.push(value)
  options.sort()
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={cn("num h-9 rounded-md border border-line-strong bg-surface-2 px-1.5 text-[13px] text-ivory focus:border-gold/50 focus:outline-none", className)}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {t || "—"}
        </option>
      ))}
    </select>
  )
}
