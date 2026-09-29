import Link from "next/link"
import { Check, CircleDashed, ExternalLink } from "lucide-react"
import { PageBody, PageHeader, Panel } from "@/components/shell/page-header"
import { ChannelDot } from "@/components/brand/channel-icons"
import { BRAND } from "@/config/brand"
import { db, now, store } from "@/lib/data/repo"
import { ServicesEditor } from "@/components/settings/services-editor"
import { TeamEditor } from "@/components/settings/team-editor"
import { FixedSlotsEditor } from "@/components/settings/fixed-slots-editor"
import { ShopSettingsForm } from "@/components/settings/shop-settings-form"
import { DepositSettingsForm } from "@/components/settings/deposit-settings-form"
import { dayKey } from "@/lib/time"
import { PROVIDER_LABEL, readAgentConfig } from "@/lib/agent/config"
import { readZernioConfig, readZernioWebhookConfig } from "@/lib/zernio/config"
import { listAccounts } from "@/lib/zernio/client"
import { ConnectLink } from "@/components/settings/connect-link"
import { cn } from "@/lib/utils"

export const metadata = { title: "Ajustes" }

const TABS = [
  { id: "servicios", label: "Servicios" },
  { id: "equipo", label: "Equipo" },
  { id: "fijos", label: "Turnos fijos" },
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
        {tab === "servicios" && <ServicesEditor services={s.services} />}

        {tab === "equipo" && <TeamEditor staff={s.staff} timeOff={s.timeOff} today={dayKey(await now())} />}

        {tab === "fijos" && <FixedSlotsEditor staff={s.staff} slots={s.fixedSlots} today={dayKey(await now())} />}

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
            <Panel title="Caja">
              <ShopSettingsForm settings={s.shopSettings} />
              <p className="mt-3 text-[12.5px] text-ivory-3">Con este monto arranca la caja cada día: el efectivo esperado es fondo + cobros en efectivo − gastos en efectivo.</p>
            </Panel>
            <Panel title="Seña con Mercado Pago">
              <DepositSettingsForm settings={s.shopSettings} />
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
async function Connections() {
  const zernio = readZernioConfig()
  const webhook = readZernioWebhookConfig()
  const agent = readAgentConfig()
  const accounts = zernio.configured ? await listAccounts({ config: zernio }) : null
  const connected = (platform: "whatsapp" | "instagram") =>
    accounts?.ok ? accounts.data.accounts.find((a) => a.platform === platform && a.isActive) : undefined
  const channel = (platform: "whatsapp" | "instagram", label: string) => {
    const account = connected(platform)
    return {
      name: label,
      icon: <ChannelDot channel={platform} />,
      ok: !!account,
      detail: !zernio.configured
        ? zernio.reason
        : accounts && !accounts.ok
          ? `No se pudo consultar Zernio: ${accounts.message}`
          : account
            ? `Conectado${account.username ? ` como ${platform === "instagram" ? "@" : ""}${account.username}` : account.displayName ? `: ${account.displayName}` : ""}.`
            : platform === "whatsapp"
              ? "Sin conectar. Generá el link y mandáselo al dueño: lo abre en una compu y escanea el QR con el celular del local (sigue usando WhatsApp Business como siempre)."
              : "Sin conectar. Tiene que ser una cuenta profesional vinculada a una página de Facebook.",
      action: zernio.configured && !account ? <ConnectLink platform={platform} label={label} /> : null,
    }
  }
  const rows = [
    channel("whatsapp", "WhatsApp"),
    channel("instagram", "Instagram"),
    {
      name: "Webhook de mensajes entrantes",
      icon: null,
      ok: webhook.configured,
      detail: webhook.configured
        ? "Firma activa. En Zernio tiene que estar registrado apuntando a /api/zernio/webhook de este panel, con el mismo secreto."
        : webhook.reason,
      action: null,
    },
    {
      name: `Agente IA (${PROVIDER_LABEL[agent.provider]})`,
      icon: null,
      ok: agent.configured,
      detail: agent.configured ? `Modelo ${agent.model}. Se cambia con AGENT_PROVIDER y AGENT_MODEL.` : agent.reason,
      action: null,
    },
    {
      name: "Base de datos (Supabase)",
      icon: null,
      ok: store().kind === "postgres",
      detail: store().kind === "postgres" ? "Conectada: todo lo que se carga queda guardado." : "Modo demo: los datos viven en memoria y se pierden al reiniciar.",
      action: null,
    },
    {
      name: "Mercado Pago",
      icon: null,
      ok: false,
      detail: "Pendiente: definir con Virex si cobran seña al reservar.",
      action: null,
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
              {r.action}
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
