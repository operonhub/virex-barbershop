import { cn } from "@/lib/utils"

/**
 * Firma del creador: "Hecho por [logo]peron", chica y sutil, clickeable a
 * operonhub.com. Usa el mark canónico "Nodo suelto" de
 * `operon-landing/brand/marca-app.jsx` (anillo + nodo amarillo + cola); la
 * tinta hereda `currentColor` y el nodo mantiene el amarillo de marca.
 */
const SOL = "#F2C94C"

export function OperonBadge({ className }: { className?: string }) {
  return (
    <a
      href="https://operonhub.com/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hecho por Operon — operonhub.com"
      title="Hecho por Operon"
      className={cn(
        "flex w-fit select-none items-center gap-[0.2em] text-[11px] tracking-[-0.02em] text-ivory-3/70 transition-colors hover:text-ivory-2",
        className
      )}
    >
      <span className="font-medium">Hecho por</span>
      <svg
        viewBox="0 0 64 74"
        className="h-[1.45em] w-auto translate-y-[0.08em]"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="32" cy="28" r="20" fill="none" stroke="currentColor" strokeWidth="6" />
        <circle cx="32" cy="28" r="6" fill={SOL} />
        <path d="M25 47 L39 47 L32 56 Z" fill="currentColor" />
        <path
          d="M32 56 C 30 63, 36 65, 33 73"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
      {/* El logo hace de "O": "[logo]peron" → "Operon". */}
      <span className="font-semibold">peron</span>
    </a>
  )
}
