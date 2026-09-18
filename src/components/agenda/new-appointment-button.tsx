"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNewAppointment } from "./new-appointment"

export function NewAppointmentButton({
  label = "Nuevo turno",
  variant = "default",
  day,
  clientId,
  className,
}: {
  label?: string
  variant?: "default" | "outline" | "secondary"
  day?: string
  clientId?: string
  className?: string
}) {
  const { open } = useNewAppointment()
  return (
    <Button size="lg" variant={variant} onClick={() => open({ day, clientId })} className={className ?? "h-10 px-4 font-semibold"}>
      <Plus /> {label}
    </Button>
  )
}
