import { cn } from "@/lib/utils"

/** Encabezado de sección: título expandido (la voz del logo) + acciones. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[26px] leading-[1.05] text-ivory sm:text-[32px]">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-[14px] text-ivory-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</div>
}

/** Panel con título. No todas las tarjetas son iguales: el contenido manda. */
export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("panel relative", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          {title && <h2 className="text-[13.5px] font-semibold text-ivory font-wide">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn("px-5 pb-5", !title && !action && "pt-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null
  const up = value >= 0
  return (
    <span className={cn("num text-[12px] font-medium", up ? "text-ok" : "text-danger", className)}>
      {up ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  )
}
