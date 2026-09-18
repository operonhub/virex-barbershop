import { PageBody, PageHeader, Panel } from "@/components/shell/page-header"
import { AgentToggle } from "@/components/agent/agent-toggle"
import { AgentSettingsForm } from "@/components/agent/agent-settings"
import { AgentPlayground } from "@/components/agent/playground"
import { ChannelDot } from "@/components/brand/channel-icons"
import { getAgente } from "@/lib/data/queries"
import { readAgentConfig } from "@/lib/agent/config"
import { formatARS, formatNumber } from "@/lib/money"
import { timeAgo } from "@/lib/time"

export const metadata = { title: "Agente IA" }

export default async function AgentePage() {
  const d = await getAgente()
  const config = readAgentConfig()
  const n = new Date(d.now)

  return (
    <PageBody>
      <PageHeader
        eyebrow="Automático"
        title="Agente IA"
        description="Responde WhatsApp e Instagram, agenda, reprograma y cancela turnos solo, y le pasa a una persona lo que no le corresponde."
        actions={<AgentToggle enabled={d.settings.enabled} />}
      />

      <section className="panel mt-8 grid grid-cols-2 sm:grid-cols-4">
        <Stat label="Turnos que agendó" value={formatNumber(d.stats.bookedMonth)} sub="este mes" />
        <Stat label="Facturaron" value={formatARS(d.stats.revenueMonth)} sub="los ya atendidos" />
        <Stat label="Conversaciones" value={formatNumber(d.stats.conversations)} sub="en la bandeja" />
        <Stat label="Derivó a una persona" value={formatNumber(d.stats.handoffs)} sub="quejas, color, dudas" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <AgentSettingsForm settings={d.settings} />
        <div className="space-y-5">
          <AgentPlayground agentName={d.settings.name} configured={config.configured} reason={config.configured ? null : config.reason} />
          <Panel title="Lo último que hizo" bodyClassName="px-0 pb-1">
            <ul>
              {d.events.map((e) => (
                <li key={e.id} className="flex items-start gap-3 border-t border-line px-5 py-2.5 first:border-0">
                  <ChannelDot channel={e.channel} className="mt-0.5" />
                  <span className="min-w-0 flex-1 text-[13px] text-ivory-2">{e.summary}</span>
                  <span className="num shrink-0 text-[11px] text-ivory-3">{timeAgo(e.at, n)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <p className="px-1 text-[12px] leading-relaxed text-ivory-3">
            Modelo: {config.configured ? config.model : "sin configurar"}. Cada respuesta se arma con los precios, horarios y
            reglas de esta pantalla; la agenda la consulta en vivo, nunca de memoria.
          </p>
        </div>
      </div>
    </PageBody>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-line px-5 py-4 not-first:border-l max-sm:nth-[3]:border-l-0 max-sm:nth-[n+3]:border-t sm:py-5">
      <p className="eyebrow truncate">{label}</p>
      <p className="num mt-2 font-wide text-[22px] leading-none font-semibold text-ivory">{value}</p>
      <p className="mt-1.5 text-[12px] text-ivory-3">{sub}</p>
    </div>
  )
}
