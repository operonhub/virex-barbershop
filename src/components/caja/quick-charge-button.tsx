"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuickChargeDialog } from "./quick-charge-dialog"
import type { LoyaltyStatus } from "@/lib/domain/loyalty"
import type { Client, Service, Staff } from "@/lib/domain/types"

export function QuickChargeButton({
  staff,
  services,
  clients,
  loyalty,
  variant = "default",
  className,
  label = "Cobro rápido (sin turno)",
}: {
  staff: Staff[]
  services: Service[]
  clients: Client[]
  loyalty: Record<string, LoyaltyStatus>
  variant?: "default" | "outline"
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="lg" variant={variant} className={className} onClick={() => setOpen(true)}>
        <Zap /> {label}
      </Button>
      <QuickChargeDialog open={open} onOpenChange={setOpen} staff={staff} services={services} clients={clients} loyalty={loyalty} />
    </>
  )
}
