"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveSlotStep } from "@/lib/data/settings-actions"
import { Choice } from "./services-editor"

const STEPS = [30, 45, 60]

/**
 * Cada cuánto arranca un turno en lo que ofrecen el agente, la reserva web y
 * "Nuevo turno" (con 45: 11:00, 11:45, 12:30…). Cambia la grilla, no la
 * duración de cada servicio.
 */
export function SlotStepForm({ value }: { value: number }) {
  const [step, setStep] = useState(value)
  const [pending, startTransition] = useTransition()

  function pick(minutes: number) {
    if (minutes === step) return
    const before = step
    setStep(minutes)
    startTransition(async () => {
      const res = await saveSlotStep(minutes)
      if (!res.ok) {
        setStep(before)
        return void toast.error(res.error)
      }
      toast.success(`Ahora se ofrecen horarios cada ${minutes} minutos`)
    })
  }

  return (
    <div className="space-y-3">
      <fieldset disabled={pending}>
        <legend className="mb-1.5 text-[12.5px] text-ivory-2">Un horario nuevo cada</legend>
        <div className="grid max-w-[360px] grid-cols-3 gap-1.5">
          {STEPS.map((m) => (
            <Choice key={m} active={step === m} onClick={() => pick(m)}>
              {m} min
            </Choice>
          ))}
        </div>
      </fieldset>
      <p className="text-[12.5px] text-ivory-3">
        Es lo que ven los clientes al reservar y lo que ofrece el agente. Los turnos ya cargados no cambian. Cuánto dura cada turno lo define el servicio, en la
        pestaña Servicios.
      </p>
    </div>
  )
}
