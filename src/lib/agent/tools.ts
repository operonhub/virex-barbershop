import "server-only"
import { db, store } from "@/lib/data/repo"
import { SlotTakenError } from "@/lib/data/store/types"
import { freeSlots, freeSlotsAnyStaff, isOpen } from "@/lib/domain/slots"
import { loyaltyStatus } from "@/lib/domain/loyalty"
import { addDays, at, dayKey, formatDayLong, hm } from "@/lib/time"
import type { AgentActionKind, Channel, Service, Staff } from "@/lib/domain/types"
import type { ToolSpec, TurnInput } from "./providers/types"
import { clientAgreedTo } from "./consent"

/**
 * Herramientas del agente: lo ÚNICO con lo que la IA puede tocar datos.
 *
 * Tres reglas:
 *  1. Se definen UNA vez, en JSON Schema; cada proveedor las traduce (Claude
 *     con `strict: true`, Gemini con `parametersJsonSchema`). Igual se
 *     revalida todo acá: no todos los modelos garantizan el schema.
 *  2. Cada herramienta revalida lo importante (permisos, horario libre, que
 *     el turno sea de ESTE cliente). El modelo propone, el código decide.
 *  3. Los resultados son JSON chico y en castellano: el modelo los lee para
 *     redactar la respuesta, así que tienen que decir qué pasó, no un código.
 *
 * Leen con `db()` y escriben con `store()`: en producción es Supabase, y el
 * doble turno lo frena la restricción EXCLUDE aunque el chequeo de acá falle.
 */

export interface ToolContext {
  conversationId: string | null
  clientId: string | null
  participantName: string
  channel: Channel
  now: Date
  /** La conversación hasta el último mensaje del cliente: para saber qué pidió o aceptó. */
  history?: TurnInput[]
}

export interface ToolOutcome {
  /** Lo que se le devuelve al modelo. */
  result: Record<string, unknown>
  isError?: boolean
  /** Acción visible en la bandeja y en el feed del agente. */
  action?: AgentActionKind
  /** Si la herramienta cambió el cliente de la conversación (se creó uno). */
  clientId?: string
}

const DATE = { type: "string", description: "Fecha en formato AAAA-MM-DD." } as const
const TIME = { type: "string", description: "Hora en formato HH:MM, 24 h." } as const

export function toolDefinitions(services: Service[], staff: Staff[]): ToolSpec[] {
  const serviceIds = services.filter((s) => s.active).map((s) => s.id)
  const staffIds = staff.filter((s) => s.active).map((s) => s.id)

  return [
    {
      name: "consultar_disponibilidad",
      description:
        "Devuelve los horarios libres para un servicio en una fecha, con un barbero puntual o con cualquiera. Usala SIEMPRE antes de ofrecer horarios, y de nuevo cada vez que el cliente pida otra franja: devuelve pocas opciones, así que no afirmes que no hay lugar a una hora sin haberla consultado con desde_hora.",
      parameters: {
        type: "object",
        properties: {
          fecha: DATE,
          servicio_id: { type: "string", enum: serviceIds },
          barbero_id: { type: "string", enum: [...staffIds, "cualquiera"] },
          desde_hora: {
            type: "string",
            description: 'Hora mínima HH:MM si el cliente pide una franja ("a la tarde" = 14:00, "después de las 6" = 18:00, "tipo 17" = 17:00). Cadena vacía si no importa.',
          },
        },
        required: ["fecha", "servicio_id", "barbero_id", "desde_hora"],
        additionalProperties: false,
      },
    },
    {
      name: "crear_turno",
      description:
        "Agenda un turno confirmado. Sólo cuando el cliente ya eligió servicio, fecha, hora y barbero. Si no es cliente registrado, pasá su nombre y teléfono.",
      parameters: {
        type: "object",
        properties: {
          fecha: DATE,
          hora: TIME,
          servicio_id: { type: "string", enum: serviceIds },
          barbero_id: { type: "string", enum: staffIds },
          nombre_cliente: { type: "string", description: "Nombre y apellido si se conoce." },
          telefono: { type: "string", description: "Teléfono del cliente, o cadena vacía si no se sabe." },
        },
        required: ["fecha", "hora", "servicio_id", "barbero_id", "nombre_cliente", "telefono"],
        additionalProperties: false,
      },
    },
    {
      name: "turnos_del_cliente",
      description: "Lista los próximos turnos del cliente de esta conversación, con su id.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
    {
      name: "reprogramar_turno",
      description: "Mueve un turno del cliente a otra fecha y hora (mismo servicio y barbero).",
      parameters: {
        type: "object",
        properties: { turno_id: { type: "string" }, fecha: DATE, hora: TIME },
        required: ["turno_id", "fecha", "hora"],
        additionalProperties: false,
      },
    },
    {
      name: "cancelar_turno",
      description: "Cancela un turno del cliente.",
      parameters: {
        type: "object",
        properties: { turno_id: { type: "string" }, motivo: { type: "string" } },
        required: ["turno_id", "motivo"],
        additionalProperties: false,
      },
    },
    {
      name: "consultar_fidelidad",
      description: "Devuelve cuántos sellos tiene el cliente en la tarjeta de fidelidad y si le toca el descuento.",
      parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
    },
    {
      name: "derivar_a_humano",
      description:
        "Pasa la conversación a una persona del equipo. Usala ante quejas, pedidos de hablar con alguien, consultas fuera de lo que sabés o dudas.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string", description: "Motivo breve, para el equipo." } },
        required: ["motivo"],
        additionalProperties: false,
      },
    },
  ]
}

const fail = (message: string): ToolOutcome => ({ result: { ok: false, error: message }, isError: true })

const NOT_AGREED =
  "No agendado: el cliente no pidió ni aceptó ese horario. Ofrecéselo con los horarios libres reales y esperá que responda antes de agendar."

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
  const s = await db()
  const perms = s.agentSettings.permissions
  const today = dayKey(ctx.now)
  const service = (id: unknown) => s.services.find((x) => x.id === id)
  const member = (id: unknown) => s.staff.find((x) => x.id === id)
  const validDay = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)

  switch (name) {
    case "consultar_disponibilidad": {
      const svc = service(input.servicio_id)
      if (!svc || !validDay(input.fecha)) return fail("Servicio o fecha inválidos.")
      if (input.fecha < today) return fail("Esa fecha ya pasó.")
      if (input.fecha > addDays(today, 45)) return fail("Sólo se agenda con hasta 45 días de anticipación.")
      if (!isOpen(input.fecha)) {
        let next = addDays(input.fecha, 1)
        while (!isOpen(next)) next = addDays(next, 1)
        return { result: { ok: true, cerrado: true, dia: formatDayLong(input.fecha), proximo_dia_abierto: next } }
      }
      const base = { day: input.fecha, service: svc, appointments: s.appointments, now: ctx.now }
      const slots =
        input.barbero_id === "cualquiera"
          ? freeSlotsAnyStaff({ ...base, staff: s.staff.filter((x) => x.active) }).map((x) => ({
              hora: x.time,
              barbero: member(x.staffId)!.name,
              barbero_id: x.staffId,
            }))
          : (() => {
              const m = member(input.barbero_id)
              return m ? freeSlots({ ...base, staff: m }).map((t) => ({ hora: t, barbero: m.name, barbero_id: m.id })) : []
            })()
      // Primero la franja que pidió el cliente; después, pocas opciones y
      // espaciadas (un chat no es una grilla). Sin el filtro, las 8 primeras
      // son todas de la mañana y "a la tarde" nunca encuentra lugar.
      const from = typeof input.desde_hora === "string" && /^\d{2}:\d{2}$/.test(input.desde_hora) ? input.desde_hora : ""
      const inRange = from ? slots.filter((x) => x.hora >= from) : slots
      const spaced = (inRange.length > 8 ? inRange.filter((_, i) => i % 2 === 0) : inRange).slice(0, 8)
      return {
        result: {
          ok: true,
          dia: formatDayLong(input.fecha),
          servicio: svc.name,
          ...(from ? { desde: from } : {}),
          horarios: spaced,
          hay_mas: inRange.length > spaced.length,
          // Si la franja está llena, se le dan los horarios reales más cercanos
          // de antes: con la lista vacía, los modelos chicos inventan uno.
          ...(from && !inRange.length
            ? { sin_lugar_en_esa_franja: true, horarios_antes: slots.filter((x) => x.hora < from).slice(-3) }
            : {}),
        },
        action: "consulta_respondida",
      }
    }

    case "crear_turno": {
      if (!perms.book) return fail("El dueño no habilitó que el agente agende. Derivá a una persona.")
      const svc = service(input.servicio_id)
      const m = member(input.barbero_id)
      if (!svc || !m || !validDay(input.fecha) || typeof input.hora !== "string") return fail("Datos del turno inválidos.")
      if (!clientAgreedTo(input.hora, ctx.history ?? [])) return fail(NOT_AGREED)
      const free = freeSlots({ day: input.fecha, service: svc, staff: m, appointments: s.appointments, now: ctx.now })
      if (!free.includes(input.hora)) {
        return fail(`${m.name} ya no tiene libre ${input.hora} el ${formatDayLong(input.fecha)}. Volvé a consultar disponibilidad.`)
      }

      const start = at(input.fecha, input.hora)
      let created: { appointmentId: string; clientId: string }
      try {
        created = await store().createAppointment({
          appointment: {
            clientId: ctx.clientId ?? undefined,
            staffId: m.id,
            serviceId: svc.id,
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + svc.durationMin * 60_000).toISOString(),
            status: "confirmado",
            source: "agente",
            price: svc.price,
            notes: null,
            conversationId: ctx.conversationId,
            createdAt: ctx.now.toISOString(),
          },
          newClient: ctx.clientId
            ? undefined
            : {
                name: String(input.nombre_cliente || ctx.participantName).trim().slice(0, 80),
                phone: String(input.telefono || "").replace(/[^\d+]/g, "") || null,
                channel: ctx.channel,
                notes: "Creado por el agente IA.",
                preferredStaffId: m.id,
              },
          linkConversationId: ctx.conversationId,
        })
      } catch (e) {
        if (e instanceof SlotTakenError) return fail(`Ese horario se acaba de ocupar. Volvé a consultar disponibilidad.`)
        throw e
      }
      const id = created.appointmentId
      const clientId = created.clientId
      return {
        result: { ok: true, turno_id: id, dia: formatDayLong(input.fecha), hora: input.hora, barbero: m.name, servicio: svc.name, precio: svc.price },
        action: "turno_creado",
        clientId,
      }
    }

    case "turnos_del_cliente": {
      if (!ctx.clientId) return { result: { ok: true, turnos: [], nota: "No es cliente registrado." } }
      const mine = s.appointments
        .filter((a) => a.clientId === ctx.clientId && new Date(a.startsAt) > ctx.now && ["pendiente", "confirmado"].includes(a.status))
        .map((a) => ({
          turno_id: a.id,
          dia: formatDayLong(dayKey(a.startsAt)),
          hora: hm(a.startsAt),
          servicio: service(a.serviceId)?.name,
          barbero: member(a.staffId)?.name,
        }))
      return { result: { ok: true, turnos: mine } }
    }

    case "reprogramar_turno": {
      if (!perms.reschedule) return fail("El dueño no habilitó reprogramar. Derivá a una persona.")
      const appt = s.appointments.find((a) => a.id === input.turno_id)
      // Un turno ajeno se trata igual que uno inexistente: no se filtra que existe.
      if (!appt || appt.clientId !== ctx.clientId) return fail("No encontré ese turno entre los del cliente.")
      if (!validDay(input.fecha) || typeof input.hora !== "string") return fail("Fecha u hora inválidas.")
      if (!clientAgreedTo(input.hora, ctx.history ?? [])) return fail(NOT_AGREED)
      const svc = service(appt.serviceId)!
      const m = member(appt.staffId)!
      const others = s.appointments.filter((a) => a.id !== appt.id)
      if (!freeSlots({ day: input.fecha, service: svc, staff: m, appointments: others, now: ctx.now }).includes(input.hora)) {
        return fail(`${m.name} no tiene libre ese horario. Consultá disponibilidad.`)
      }
      const start = at(input.fecha, input.hora)
      try {
        await store().updateAppointment(appt.id, {
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + svc.durationMin * 60_000).toISOString(),
          notes: "Reprogramado por el agente IA.",
        })
      } catch (e) {
        if (e instanceof SlotTakenError) return fail(`${m.name} ya no tiene libre ese horario. Consultá disponibilidad.`)
        throw e
      }
      return {
        result: { ok: true, dia: formatDayLong(input.fecha), hora: input.hora, barbero: m.name, servicio: svc.name },
        action: "turno_reprogramado",
      }
    }

    case "cancelar_turno": {
      if (!perms.cancel) return fail("El dueño no habilitó cancelar. Derivá a una persona.")
      const appt = s.appointments.find((a) => a.id === input.turno_id)
      if (!appt || appt.clientId !== ctx.clientId) return fail("No encontré ese turno entre los del cliente.")
      await store().updateAppointment(appt.id, { status: "cancelado", notes: `Cancelado por el agente: ${String(input.motivo).slice(0, 200)}` })
      return { result: { ok: true, cancelado: true }, action: "turno_cancelado" }
    }

    case "consultar_fidelidad": {
      if (!perms.shareLoyalty) return fail("El dueño no habilitó informar la tarjeta.")
      if (!ctx.clientId) return { result: { ok: true, sellos: 0, nota: "Todavía no es cliente: arranca con su primer corte." } }
      const st = loyaltyStatus(ctx.clientId, s.payments, s.services)
      return {
        result: { ok: true, sellos: st.stamps, necesarios: st.required, le_toca_descuento: st.rewardReady },
        action: "sello_consultado",
      }
    }

    case "derivar_a_humano": {
      if (ctx.conversationId) {
        await store().updateConversation(ctx.conversationId, { mode: "humano", needsHuman: true, handoffReason: String(input.motivo).slice(0, 120) })
      }
      return { result: { ok: true, derivado: true }, action: "derivado_humano" }
    }

    default:
      return fail(`Herramienta desconocida: ${name}`)
  }
}
