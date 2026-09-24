"use client"

import { useActionState } from "react"
import { LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { login, type LoginState } from "./actions"

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null })

  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-[12.5px] text-ivory-2">Contraseña del panel</span>
        <span className="relative block">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ivory-3" />
          <input
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="h-12 w-full rounded-lg border border-line-strong bg-surface-2 pr-3 pl-10 text-[15px] text-ivory focus:border-gold/50 focus:outline-none"
          />
        </span>
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full text-[15px]">
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  )
}
