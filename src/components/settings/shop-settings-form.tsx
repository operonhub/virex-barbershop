"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { saveShopSettings } from "@/lib/data/settings-actions"
import type { ShopSettings } from "@/lib/domain/types"

/** Fondo de caja: el efectivo con el que se abre cada día. La caja lo usa para calcular el efectivo esperado. */
export function ShopSettingsForm({ settings }: { settings: ShopSettings }) {
  const [cash, setCash] = useState(String(settings.openingCash))
  const [pending, startTransition] = useTransition()
  const dirty = Number(cash || 0) !== settings.openingCash

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">
        <span className="mb-1.5 block text-[12.5px] text-ivory-2">Fondo de caja al abrir</span>
        <span className="relative block max-w-[220px]">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-ivory-3">$</span>
          <input
            value={cash}
            onChange={(e) => setCash(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="num h-10 w-full rounded-lg border border-line-strong bg-surface-2 pr-3 pl-7 text-[14px] text-ivory focus:border-gold/50 focus:outline-none"
          />
        </span>
      </label>
      {dirty && (
        <Button
          disabled={pending}
          className="h-10"
          onClick={() =>
            startTransition(async () => {
              const res = await saveShopSettings({ openingCash: Number(cash || 0) })
              if (res.ok) toast.success("Fondo de caja guardado")
              else toast.error(res.error)
            })
          }
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      )}
    </div>
  )
}
