import { Inbox, type InboxFilter } from "@/components/inbox/inbox"
import { getBandeja } from "@/lib/data/queries"

export const metadata = { title: "Bandeja" }

const FILTERS: InboxFilter[] = ["todas", "sin_leer", "humano", "ia"]

export default async function BandejaPage({ searchParams }: PageProps<"/bandeja">) {
  const params = await searchParams
  const d = await getBandeja()
  const filter = FILTERS.includes(params.filtro as InboxFilter) ? (params.filtro as InboxFilter) : "todas"
  const selectedId = typeof params.c === "string" ? params.c : null

  return (
    <Inbox
      now={d.now}
      conversations={d.conversations}
      messages={d.messages}
      clients={d.clients}
      staff={d.staff}
      services={d.services}
      appointments={d.appointments}
      loyalty={d.loyalty}
      agentName={d.agentName}
      selectedId={selectedId}
      filter={filter}
    />
  )
}
