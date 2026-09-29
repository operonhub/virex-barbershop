"use client"

import { useState, useTransition } from "react"
import { Check, Copy, Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createConnectLink } from "@/lib/zernio/actions"

/**
 * "Generar link": pide a Zernio el link de conexión y lo deja listo para
 * copiar y mandárselo al dueño. Él lo abre en SUS dispositivos (para WhatsApp,
 * conviene en una compu: escanea el QR con el celular del local).
 */
export function ConnectLink({ platform, label }: { platform: "whatsapp" | "instagram"; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      const res = await createConnectLink(platform)
      if (!res.ok) return void toast.error(res.error)
      setUrl(res.url)
      setCopied(false)
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link copiado: mandáselo al dueño")
    } catch {
      toast.error("No se pudo copiar: seleccioná el link y copialo a mano.")
    }
  }

  if (!url) {
    return (
      <Button variant="outline" size="sm" className="mt-2" disabled={pending} onClick={generate}>
        <Link2 /> {pending ? "Generando…" : `Generar link para conectar ${label}`}
      </Button>
    )
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={`Link para conectar ${label}`}
        className="h-9 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-3 text-[12.5px] text-ivory-2"
      />
      <Button size="sm" className="h-9" onClick={copy}>
        {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  )
}
