import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-lime-100 text-lime-700',
        confirmado: 'bg-lime-100 text-lime-700',
        pendiente: 'bg-yellow-100 text-yellow-700',
        cancelado: 'bg-red-100 text-red-700',
        whatsapp: 'bg-green-100 text-green-700',
        instagram: 'bg-pink-100 text-pink-700',
        tiktok: 'bg-zinc-100 text-zinc-700',
        efectivo: 'bg-blue-100 text-blue-700',
        transferencia: 'bg-purple-100 text-purple-700',
        debito: 'bg-orange-100 text-orange-700',
        outline: 'border border-gray-200 text-gray-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
