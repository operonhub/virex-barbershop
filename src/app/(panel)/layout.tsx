import { IntroOverlay } from "@/components/brand/intro"
import { Sidebar } from "@/components/shell/sidebar"
import { Topbar } from "@/components/shell/topbar"
import { MobileNav } from "@/components/shell/mobile-nav"
import { NewAppointmentProvider } from "@/components/agenda/new-appointment"
import { getShell } from "@/lib/data/queries"
import { db } from "@/lib/data/repo"
import { addDays, dayKey } from "@/lib/time"

export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const shell = await getShell()
  const s = await db()
  const today = dayKey(shell.now)
  const horizon = addDays(today, 15)

  return (
    <NewAppointmentProvider
      catalog={{
        staff: s.staff,
        services: s.services,
        clients: s.clients,
        appointments: s.appointments.filter((a) => {
          const d = dayKey(a.startsAt)
          return d >= today && d <= horizon
        }),
        now: shell.now,
      }}
    >
      <IntroOverlay />
      <div className="flex min-h-dvh">
        <Sidebar info={shell} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar info={shell} now={shell.now} simulated={shell.simulated} />
          <main className="flex-1 pb-24 lg:pb-10">{children}</main>
        </div>
      </div>
      <MobileNav info={shell} />
    </NewAppointmentProvider>
  )
}
