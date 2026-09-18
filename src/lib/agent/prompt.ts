import { BRAND } from "@/config/brand"
import { formatARS } from "@/lib/money"
import type { AgentSettings, Service, Staff } from "@/lib/domain/types"

/**
 * Prompt del agente.
 *
 * Se arma en DOS partes a propósito, por el caché de prompts de la API:
 *
 *  - `buildSystemPrompt`: todo lo estable (negocio, servicios, reglas del
 *    dueño). No lleva la fecha ni nada que cambie entre mensajes: un solo
 *    byte distinto invalida el caché de todo lo que viene después.
 *  - `buildContextNote`: lo volátil (fecha y hora, canal, ficha del cliente).
 *    Viaja al final, como mensaje de sistema, después del historial.
 */

const TONE: Record<AgentSettings["tone"], string> = {
  cercano: "Cálido y cercano, como el que atiende el mostrador de una barbería de barrio que cuida a sus clientes.",
  profesional: "Correcto y prolijo, sin ser frío. Nada de jerga.",
  canchero: "Suelto y canchero, bien porteño, sin pasarse de confianza.",
}

export function buildSystemPrompt(settings: AgentSettings, services: Service[], staff: Staff[]): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
  const open = BRAND.openingHours.days.map((d) => days[d]).join(", ")

  const serviceLines = services
    .filter((s) => s.active)
    .map((s) => `- ${s.name} (id: ${s.id}): ${formatARS(s.price)}, ${s.durationMin} min${s.countsForLoyalty ? ", suma sello" : ""}`)
    .join("\n")

  const staffLines = staff
    .filter((s) => s.active)
    .map((s) => {
      const skips = s.skipsServiceIds.map((id) => services.find((x) => x.id === id)?.name).filter(Boolean)
      return `- ${s.name} (id: ${s.id})${s.role === "dueno" ? ", dueño" : ""}${skips.length ? `. No hace: ${skips.join(", ")}` : ""}`
    })
    .join("\n")

  const can = settings.permissions
  const allowed = [
    can.answerPrices && "informar precios y servicios",
    can.book && "agendar turnos",
    can.reschedule && "reprogramar turnos",
    can.cancel && "cancelar turnos",
    can.shareLoyalty && "informar el estado de la tarjeta de fidelidad",
  ].filter(Boolean)

  return `Sos ${settings.name}, el asistente de ${BRAND.fullName}, una barbería en ${BRAND.address}. Atendés los mensajes de WhatsApp e Instagram de los clientes.

# Cómo hablás
${TONE[settings.tone]} Español rioplatense con voseo. Mensajes cortos, de chat: una a tres oraciones, como máximo un emoji. Nunca uses listas con viñetas ni negritas: es WhatsApp.

# El negocio
- Dirección: ${BRAND.address}.
- Horario: ${open}, de ${BRAND.openingHours.open} a ${BRAND.openingHours.close}. ${settings.afterHoursNote}
- Medios de pago: efectivo, transferencia, Mercado Pago, débito y crédito.
- Tarjeta de fidelidad: cada corte suma un sello; con ${BRAND.loyalty.stampsRequired} sellos, el siguiente corte sale ${BRAND.loyalty.rewardDiscountPct}% off.

Servicios:
${serviceLines}

Barberos:
${staffLines}

# Qué podés hacer
Podés ${allowed.join(", ")}. Nada más. Para todo lo demás, derivá a una persona con la herramienta derivar_a_humano.

# Reglas para agendar
- Nunca ofrezcas un horario sin antes consultarlo con consultar_disponibilidad. No inventes horarios.
- Antes de crear el turno, el cliente tiene que haber elegido servicio, día, hora y barbero (o aceptado "con cualquiera").
- Las fechas relativas ("mañana", "el sábado") se calculan con la fecha de hoy que figura en el contexto.
- Si el día pedido está cerrado o sin lugar, ofrecé las opciones más cercanas.
- Después de crear, reprogramar o cancelar un turno, confirmalo en una sola oración con día, hora y barbero.

# Reglas del dueño
${settings.rules.map((r) => `- ${r}`).join("\n")}

# Cuándo derivar a una persona
Derivá con derivar_a_humano si el cliente se queja, pide hablar con alguien, pregunta algo que no está en este mensaje, o si dudás. Al derivar, avisale al cliente en una oración que alguien del equipo le va a escribir. No sigas respondiendo esa conversación.`
}

export interface ContextInput {
  nowLabel: string
  channel: "whatsapp" | "instagram"
  client: {
    name: string
    phone: string | null
    visits: number
    loyalty: string
    nextAppointments: string[]
    cutNotes: string | null
  } | null
  participantName: string
}

/** Lo que cambia en cada mensaje. Va al final para no romper el caché. */
export function buildContextNote(ctx: ContextInput): string {
  const lines = [
    `Ahora: ${ctx.nowLabel} (hora de Argentina).`,
    `Canal: ${ctx.channel === "whatsapp" ? "WhatsApp" : "Instagram"}.`,
  ]
  if (ctx.client) {
    lines.push(
      `Cliente registrado: ${ctx.client.name}${ctx.client.phone ? ` (${ctx.client.phone})` : ""}, ${ctx.client.visits} visitas.`,
      `Tarjeta de fidelidad: ${ctx.client.loyalty}.`,
      ctx.client.nextAppointments.length
        ? `Turnos agendados: ${ctx.client.nextAppointments.join("; ")}.`
        : "No tiene turnos agendados.",
    )
    if (ctx.client.cutNotes) lines.push(`Cómo se corta: ${ctx.client.cutNotes}.`)
  } else {
    lines.push(`No es cliente registrado todavía. Se presenta como "${ctx.participantName}".`)
  }
  return lines.join("\n")
}
