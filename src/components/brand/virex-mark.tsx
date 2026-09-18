"use client"

import { useId } from "react"
import { cn } from "@/lib/utils"

/**
 * Isotipo de la app: el emblema de Virex reducido a lo esencial.
 *
 * Toma los cuatro elementos del logo real — doble anillo, la V de VIREX
 * (sans extendida, geométrica), el "bigote/ala" que va debajo de BARBERSHOP
 * y el destello ✦ que usan en toda su comunicación — y los ordena para que
 * se lean a 28 px en el sidebar y a 120 px en la intro.
 *
 * El id del degradado es único por instancia (`useId`). Si fuera fijo, el
 * navegador resolvería la referencia contra el PRIMER SVG del documento, que
 * es el de la intro, oculto con display:none — y ahí Chrome deja el relleno
 * vacío en todos los demás.
 */
export function VirexMark({
  size = 32,
  detail = size >= 44,
  animated = false,
  className,
  title = "Virex",
}: {
  size?: number
  /** Anillo interior y ala: se omiten en tamaños chicos porque ensucian. */
  detail?: boolean
  /** Agrega las clases de la intro (anillo que se dibuja, V que aparece…). */
  animated?: boolean
  className?: string
  title?: string
}) {
  const id = useId().replace(/:/g, "")
  const gold = `vx-gold-${id}`
  const shine = `vx-shine-${id}`

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={gold} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#7a5a26" />
          <stop offset="0.24" stopColor="#c9a24e" />
          <stop offset="0.45" stopColor="#f1dda6" />
          <stop offset="0.52" stopColor="#fff3c9" />
          <stop offset="0.66" stopColor="#d6b36a" />
          <stop offset="1" stopColor="#8c6a2f" />
        </linearGradient>
        <radialGradient id={shine} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.45" stopColor="#f1dda6" />
          <stop offset="1" stopColor="#f1dda6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Anillos */}
      <circle
        cx="32"
        cy="32"
        r="29.4"
        fill="none"
        stroke={`url(#${gold})`}
        strokeWidth={detail ? 1.5 : 2.4}
        pathLength={200}
        className={animated ? "virex-intro__ring" : undefined}
      />
      {detail && (
        <circle
          cx="32"
          cy="32"
          r="25.8"
          fill="none"
          stroke={`url(#${gold})`}
          strokeWidth="0.7"
          strokeOpacity="0.75"
          pathLength={200}
          className={animated ? "virex-intro__ring virex-intro__ring--inner" : undefined}
        />
      )}

      {/* La V: brazos paralelos, planos arriba, como las letras del logo */}
      <path
        d={
          detail
            ? "M18 18.6h6.3L32 35.1l7.7-16.5H46L34.35 43.4h-4.7z"
            : "M14.5 15.5h8.6L32 35.4l8.9-19.9h8.6L35.2 47.5h-6.4z"
        }
        fill={`url(#${gold})`}
        className={animated ? "virex-intro__v" : undefined}
      />

      {/* El ala/bigote de debajo de BARBERSHOP */}
      {detail && (
        <path
          d="M19.5 46.8c4.6 2.3 8.4 2.9 12.5 4.9 4.1-2 7.9-2.6 12.5-4.9-4.3 1.2-8.2 1.5-12.5 3.1-4.3-1.6-8.2-1.9-12.5-3.1z"
          fill={`url(#${gold})`}
          className={animated ? "virex-intro__wing" : undefined}
        />
      )}

      {/* Destello ✦ sobre el anillo, arriba a la derecha */}
      <g className={animated ? "virex-intro__glint" : undefined}>
        <circle cx="52.8" cy="11.2" r="5" fill={`url(#${shine})`} opacity="0.55" />
        <path
          d="M52.8 5.6Q53.35 10.65 58.4 11.2 53.35 11.75 52.8 16.8 52.25 11.75 47.2 11.2 52.25 10.65 52.8 5.6z"
          fill="#fff3c9"
        />
      </g>
    </svg>
  )
}
