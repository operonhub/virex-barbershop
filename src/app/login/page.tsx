import { VirexMark } from "@/components/brand/virex-mark"
import { OperonBadge } from "@/components/brand/operon-badge"
import { LoginForm } from "./login-form"

export const metadata = { title: "Entrar", robots: { index: false, follow: false } }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = typeof params.next === "string" ? params.next : "/"

  return (
    <main className="flex min-h-dvh flex-col bg-obsidian bg-slats px-4">
      <div className="m-auto w-full max-w-[360px] py-12">
        <div className="flex flex-col items-center text-center">
          <VirexMark size={56} />
          <h1 className="mt-4 font-display text-gold-metal text-[26px] tracking-[0.05em]">VIREX</h1>
          <p className="eyebrow mt-1 text-[10px] tracking-[0.3em]">Barbershop · Panel</p>
        </div>
        <LoginForm next={next} />
        <p className="mt-6 text-center text-[12px] text-ivory-3">
          ¿Buscás turno?{" "}
          <a href="/reservar" className="text-ivory-2 underline underline-offset-2 hover:text-ivory">
            Reservá acá
          </a>
        </p>
      </div>
      <OperonBadge className="mx-auto pb-6" />
    </main>
  )
}
