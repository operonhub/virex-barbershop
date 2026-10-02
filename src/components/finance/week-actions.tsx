"use client"

import { useState } from "react"
import { HandCoins, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ExpenseDialog } from "@/components/caja/expense-dialog"
import type { ExpenseCategory, Staff } from "@/lib/domain/types"

/** Atajos del cierre semanal: cargar un vale o registrar un pago, sin ir a Caja. */
export function WeekActions({ staff }: { staff: Staff[] }) {
  const [preset, setPreset] = useState<{ category: ExpenseCategory; key: number } | null>(null)
  return (
    <>
      <Button variant="outline" size="lg" className="h-10" onClick={() => setPreset({ category: "vale", key: Date.now() })}>
        <HandCoins /> Cargar vale
      </Button>
      <Button variant="outline" size="lg" className="h-10" onClick={() => setPreset({ category: "sueldos", key: Date.now() })}>
        <Wallet /> Registrar pago
      </Button>
      {preset && (
        <ExpenseDialog
          key={preset.key}
          open
          onOpenChange={(o) => !o && setPreset(null)}
          staff={staff}
          initialCategory={preset.category}
        />
      )}
    </>
  )
}
