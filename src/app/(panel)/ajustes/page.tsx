import Link from "next/link"
import { Check, CircleDashed, ExternalLink } from "lucide-react"
import { PageBody, PageHeader, Panel } from "@/components/shell/page-header"
import { ChannelDot } from "@/components/brand/channel-icons"
import { BRAND } from "@/config/brand"
import { db } from "@/lib/data/repo"
import { PROVIDER_LABEL, readAgentConfig } from "@/lib/agent/config"
import { readZernioConfig, readZernioWebhookConfig } from "@/lib/zernio/config"
import { formatARS } from "@/lib/money"
import { cn } from "@/lib/utils"

export const metadata = { title: "Ajustes" }

const TABS = [
  { id: "servicios", label: "Servicios" },
  { id: "equipo", label: "Equipo" },
  { id: "local", label: "Local y fidelidad" },
  { id: "conexiones", label: "Conexiones" },
] as const

export default async function AjustesPage({ searchParams }: PageProps<"/ajustes">) {
  const params = await searchParams
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "servicios"
  const s = await db()

  return (
    <PageBody>
      <PageHeader
        eyebrow="Configuración"
        title="Ajustes"
        description="Lo que acá se cambia lo usan la agenda, la caja y el agente al mismo tiempo."
      />

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-surface-1 p-1 sm:w-fit" aria-label="Secciones de ajustes">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/ajustes?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "h-9 shrink-0 rounded-md px-4 text-[13px] leading-9 font-medium transition-colors",
              tab === t.id ? "bg-surface-3 text-ivory" : "text-ivory-3 hover:text-ivory-2"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-5 max-w-3xl">
        {tab === "servicios" && (
          <Panel title="Servicios y precios" bodyClassName="px-0 pb-1">
            <p className="px-5 pb-3 text-[12.5px] text-ivory-3">⚠ Precios y duraciones de ejemplo: se confirman con Virex.</p>
            <ul>
              {s.services.map((sv) => (
                <li key={sv.id} className="flex items-center gap-4 border-t border-line px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ivory">{sv.name}</span>
                    <span className="block text-[12px] text-ivory-3">
                      {sv.durationMin} min{sv.countsForLoyalty ? " · suma sello de fidelidad" : ""}
                    </span>
                  </span>
                  <span className="num text-[14px] font-medium text-ivory">{formatARS(sv.price)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {tab === "equipo" && (
          <Panel title="Equipo" bodyClassName="px-0 pb-1">
            <p className="px-5 pb-3 text-[12.5px] text-ivory-3">⚠ Nombres y comisiones de ejemplo.</p>
            <ul>
              {s.staff.map((m) => (
                <li key={m.id} className="flex items-center gap-4 border-t border-line px-5 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-surface-3 text-[13px] font-semibold text-ivory">{m.name[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ivory">{m.name}</span>
                    <span className="block text-[12px] text-ivory-3">
                      {m.role === "dueno" ? "Dueño" : `Barbero · ${m.commissionPct}% de comisión + propinas`}
                      {m.skipsServiceIds.length > 0 &&
                        ` · no hace ${m.skipsServiceIds.map((id) => s.services.find((x) => x.id === id)?.name).join(", ")}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {tab === "local" && (
          <div className="space-y-5">
            <Panel title="El local">
              <dl className="grid gap-4 text-[14px] sm:grid-cols-2">
                <Item label="Dirección" value={BRAND.address} />
                <Item label="Horario" value={`Martes a sábado, ${BRAND.openingHours.open} a ${BRAND.openingHours.close}`} />
                <Item label="Instagram" value={`@${BRAND.instagram}`} />
                <Item label="Zona horaria" value="Argentina (UTC−3)" />
              </dl>
            </Panel>
            <Panel title="Tarjeta de fidelidad">
              <p className="text-[14px] text-ivory-2">
                Cada servicio con corte suma un sello. Con <b className="text-ivory">{BRAND.loyalty.stampsRequired} sellos</b>, el siguiente corte
                sale <b className="text-ivory">{BRAND.loyalty.rewardDiscountPct}% off</b> — la misma regla de la tarjeta física que ya entregan.
                El descuento se aplica solo al cobrar.
              </p>
            </Panel>
          </div>
        )}

        {tab === "conexiones" && <Connections />}
      </div>
    </PageBody>
  )
}

/** Estado real de cada integración. Nada simulado: si falta algo, dice qué. */
function Connections() {
  const zernio = readZernioConfig()
  const webhook = readZernioWebhookConfig()
  const agent = readAgentConfig()
  const rows = [
    {
      name: "Zernio (WhatsApp + Instagram)",
      icon: (
        <span className="flex -space-x-1">
          <ChannelDot channel="whatsapp" />
          <ChannelDot channel="instagram" />
        </span>
      ),
      ok: zernio.configured,
      detail: zernio.configured ? "Clave cargada. Falta conectar las cuentas del local en el panel de Zernio." : zernio.reason,
    },
    {
      name: "Webhook de mensajes entrantes",
      icon: null,
      ok: webhook.configured,
      detail: webhook.configured ? "Firma HMAC activa en /api/zernio/webhook." : webhook.reason,
    },
    {
      name: `Agente IA (${PROVIDER_LABEL[agent.provider]})`,
      icon: null,
      ok: agent.configured,
      detail: agent.configured ? `Modelo ${agent.model}. Se cambia con AGENT_PROVIDER y AGENT_MODEL.` : agent.reason,
    },
    {
      name: "Mercado Pago",
      icon: null,
      ok: false,
      detail: "Pendiente: definir con Virex si cobran seña al reservar. El módulo de cobros ya registra MP como medio de pago.",
    },
    {
      name: "Base de datos (Supabase)",
      icon: null,
      ok: false,
      detail: "Modo demo: los datos viven en memoria. El esquema está listo en supabase/migrations/0001_core.sql.",
    },
  ]
  return (
    <Panel title="Conexiones" bodyClassName="px-0 pb-1">
      <ul>
        {rows.map((r) => (
          <li key={r.name} className="flex items-start gap-3 border-t border-line px-5 py-3.5">
            {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-ok" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-ivory-3" />}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-medium text-ivory">
                {r.name} {r.icon}
              </span>
              <span className="block text-[12.5px] text-ivory-3">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <a
        href="https://zernio.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-5 mt-2 mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-ivory-3 hover:text-ivory"
      >
        Panel de Zernio <ExternalLink className="size-3" />
      </a>
    </Panel>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow mb-1 text-[10px]">{label}</dt>
      <dd className="text-ivory">{value}</dd>
    </div>
  )
}
