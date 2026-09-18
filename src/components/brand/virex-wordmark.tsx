import { cn } from "@/lib/utils"

/**
 * "VIREX" + "BARBERSHOP", como en el logo: la palabra expandida en oro
 * metálico y el descriptor chico, espaciado, entre dos filetes.
 *
 * Es texto real (Archivo al 125 % de ancho), no un SVG: se lee, se
 * selecciona y hereda el tamaño del contenedor.
 */
export function VirexWordmark({
  className,
  descriptor = true,
}: {
  className?: string
  descriptor?: boolean
}) {
  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)}>
      <span className="font-display text-gold-metal text-[1.35em] tracking-[0.04em]">VIREX</span>
      {descriptor && (
        <span className="mt-[0.3em] flex w-full items-center gap-[0.4em] text-[0.42em] font-semibold tracking-[0.34em] text-ivory-2 font-wide">
          <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/60" />
          BARBERSHOP
          <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/60" />
        </span>
      )}
    </span>
  )
}
