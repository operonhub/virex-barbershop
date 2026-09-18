import { Suspense } from "react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { ClientsView } from "@/components/clients/clients-view"
import { NewAppointmentButton } from "@/components/agenda/new-appointment-button"
import { getClientes } from "@/lib/data/queries"

export const metadata = { title: "Clientes" }

export default async function ClientesPage() {
  const d = await getClientes()
  const frequent = d.rows.filter((r) => r.segment === "frecuente").length
  const atRisk = d.rows.filter((r) => r.segment === "en_riesgo").length

  return (
    <PageBody>
      <PageHeader
        eyebrow="Cartera"
        title="Clientes"
        description={`${d.rows.length} clientes · ${frequent} frecuentes · ${atRisk} dejaron de venir. Cada ficha guarda cómo se corta, sus visitas y su tarjeta de fidelidad.`}
        actions={<NewAppointmentButton variant="outline" />}
      />
      <Suspense>
        <ClientsView rows={d.rows} now={d.now} services={d.services} staff={d.staff} />
      </Suspense>
    </PageBody>
  )
}
