import "server-only"
import postgres from "postgres"
import { summarizeAction } from "@/lib/domain/agent-events"
import type {
  AgentEvent,
  AgentSettings,
  Appointment,
  Client,
  Conversation,
  Expense,
  Message,
  Payment,
  Service,
  Staff,
} from "@/lib/domain/types"
import { AlreadyChargedError, SlotTakenError, type Snapshot, type Store } from "./types"

/**
 * La base real (Supabase / Postgres) con `postgres` (porsager).
 *
 * El servidor corre siempre prendido en Railway, así que hay UN pool de
 * conexiones reutilizado entre pedidos (vía Session pooler de Supabase:
 * la conexión directa es sólo IPv6 y Railway sale por IPv4).
 *
 * Las reglas duras las garantiza la base, no este archivo:
 *   23P01 (EXCLUDE appointments_no_overlap) → SlotTakenError
 *   23505 en payments (un solo cobro por turno) → AlreadyChargedError
 */

const g = globalThis as unknown as { __virexSql?: postgres.Sql }

export function sqlClient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("Falta DATABASE_URL.")
  g.__virexSql ??= postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    // El pooler de Supabase en modo sesión los soporta, pero así el mismo
    // código funciona también con el modo transacción.
    prepare: false,
  })
  return g.__virexSql
}

/** Ventanas de lectura: lo que una barbería consulta en el día a día. */
const HISTORY_DAYS = 400
const MESSAGES_DAYS = 90

const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString())
const isoOr = (d: Date | string) => new Date(d).toISOString()

type Row = Record<string, unknown>

const toStaff = (r: Row): Staff => ({
  id: r.id as string,
  name: r.name as string,
  role: r.role as Staff["role"],
  commissionPct: Number(r.commission_pct),
  active: r.active as boolean,
  skipsServiceIds: (r.skips as string[] | null) ?? [],
})

const toService = (r: Row): Service => ({
  id: r.id as string,
  name: r.name as string,
  category: r.category as Service["category"],
  durationMin: Number(r.duration_min),
  price: Number(r.price),
  countsForLoyalty: r.counts_for_loyalty as boolean,
  active: r.active as boolean,
})

const toClient = (r: Row): Client => ({
  id: r.id as string,
  name: r.name as string,
  phone: (r.phone as string) ?? null,
  instagram: (r.instagram as string) ?? null,
  channel: (r.channel as Client["channel"]) ?? null,
  cutNotes: (r.cut_notes as string) ?? null,
  notes: (r.notes as string) ?? null,
  preferredStaffId: (r.preferred_staff_id as string) ?? null,
  createdAt: isoOr(r.created_at as Date),
})

const toAppointment = (r: Row): Appointment => ({
  id: r.id as string,
  clientId: r.client_id as string,
  staffId: r.staff_id as string,
  serviceId: r.service_id as string,
  startsAt: isoOr(r.starts_at as Date),
  endsAt: isoOr(r.ends_at as Date),
  status: r.status as Appointment["status"],
  source: r.source as Appointment["source"],
  price: Number(r.price),
  notes: (r.notes as string) ?? null,
  conversationId: (r.conversation_id as string) ?? null,
  createdAt: isoOr(r.created_at as Date),
})

const toPayment = (r: Row): Payment => ({
  id: r.id as string,
  appointmentId: (r.appointment_id as string) ?? null,
  clientId: (r.client_id as string) ?? null,
  staffId: (r.staff_id as string) ?? null,
  serviceId: (r.service_id as string) ?? null,
  concept: r.concept as string,
  kind: r.kind as Payment["kind"],
  listPrice: Number(r.list_price),
  discount: Number(r.discount),
  discountReason: (r.discount_reason as Payment["discountReason"]) ?? null,
  tip: Number(r.tip),
  amount: Number(r.amount),
  method: r.method as Payment["method"],
  paidAt: isoOr(r.paid_at as Date),
})

const toExpense = (r: Row): Expense => ({
  id: r.id as string,
  category: r.category as Expense["category"],
  description: r.description as string,
  amount: Number(r.amount),
  method: r.method as Expense["method"],
  paidAt: isoOr(r.paid_at as Date),
})

const toConversation = (r: Row): Conversation => ({
  id: r.id as string,
  externalId: r.zernio_id as string,
  accountExternalId: r.zernio_account_id as string,
  channel: r.channel as Conversation["channel"],
  clientId: (r.client_id as string) ?? null,
  participantName: (r.participant_name as string) ?? (r.participant_handle as string) ?? "Contacto",
  participantHandle: (r.participant_handle as string) ?? null,
  mode: r.mode as Conversation["mode"],
  unread: Number(r.unread),
  lastMessageAt: iso(r.last_message_at as Date) ?? new Date(0).toISOString(),
  lastInboundAt: iso(r.last_inbound_at as Date),
  needsHuman: r.needs_human as boolean,
  handoffReason: (r.handoff_reason as string) ?? null,
})

const toMessage = (r: Row): Message => ({
  id: r.id as string,
  conversationId: r.conversation_id as string,
  author: r.author as Message["author"],
  staffId: (r.staff_id as string) ?? null,
  body: (r.body as string) ?? "",
  sentAt: isoOr(r.sent_at as Date),
  action: (r.action as Message["action"]) ?? null,
  actionRef: (r.action_ref as string) ?? null,
})

const toAgentSettings = (r: Row): AgentSettings => ({
  enabled: r.enabled as boolean,
  name: r.name as string,
  tone: r.tone as AgentSettings["tone"],
  channels: r.channels as AgentSettings["channels"],
  permissions: r.permissions as AgentSettings["permissions"],
  rules: (r.rules as string[]) ?? [],
  afterHoursNote: (r.after_hours_note as string) ?? "",
})

/** El feed "Lo último que hizo" sale de los mensajes del agente con acción. */
function deriveAgentEvents(messages: Message[], conversations: Conversation[]): AgentEvent[] {
  const byId = new Map(conversations.map((c) => [c.id, c]))
  return messages
    .filter((m) => m.author === "ia" && m.action)
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    .slice(0, 50)
    .flatMap((m) => {
      const conv = byId.get(m.conversationId)
      return conv
        ? [{ id: m.id, at: m.sentAt, kind: m.action!, channel: conv.channel, conversationId: conv.id, summary: summarizeAction(m.action!, conv.participantName) }]
        : []
    })
}

const code = (e: unknown) => (e as { code?: string })?.code

export const postgresStore: Store = {
  kind: "postgres",

  async now() {
    return new Date()
  },

  async snapshot(): Promise<Snapshot> {
    const sql = sqlClient()
    const [staff, services, clients, appointments, payments, expenses, conversations, messages, settings, shifts, timeOff, shop, closures] = await Promise.all([
      sql`select s.*, coalesce(array_agg(e.service_id) filter (where e.service_id is not null), '{}') as skips
          from staff s left join staff_service_exclusions e on e.staff_id = s.id
          group by s.id order by s.id`,
      sql`select * from services order by sort, name`,
      sql`select * from clients order by created_at`,
      sql`select * from appointments where starts_at > now() - make_interval(days => ${HISTORY_DAYS}) order by starts_at`,
      sql`select * from payments where paid_at > now() - make_interval(days => ${HISTORY_DAYS}) order by paid_at`,
      sql`select * from expenses where paid_at > now() - make_interval(days => ${HISTORY_DAYS}) order by paid_at`,
      sql`select * from conversations order by last_message_at desc nulls last`,
      sql`select * from messages where sent_at > now() - make_interval(days => ${MESSAGES_DAYS}) order by sent_at`,
      sql`select * from agent_settings where id = 1`,
      sql`select staff_id, weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as "end" from staff_schedules order by weekday, start_time`,
      sql`select id, staff_id, starts_at, ends_at, reason from staff_time_off where ends_at > now() - interval '1 day' order by starts_at`,
      sql`select * from shop_settings where id = 1`,
      sql`select to_char(business_day, 'YYYY-MM-DD') as day, opening_cash, expected_cash, counted_cash, closed_at, notes
          from cash_sessions where business_day > current_date - ${HISTORY_DAYS}::int and closed_at is not null order by business_day`,
    ])
    const convs = conversations.map(toConversation)
    const msgs = messages.map(toMessage)
    return {
      now: new Date().toISOString(),
      simulated: false,
      staff: staff.map((r) => ({
        ...toStaff(r),
        schedule: shifts.filter((x) => x.staff_id === r.id).map((x) => ({ weekday: Number(x.weekday), start: x.start as string, end: x.end as string })),
        timeOff: timeOff.filter((x) => x.staff_id === r.id).map((x) => ({ startsAt: isoOr(x.starts_at as Date), endsAt: isoOr(x.ends_at as Date) })),
      })),
      services: services.map(toService),
      clients: clients.map(toClient),
      appointments: appointments.map(toAppointment),
      payments: payments.map(toPayment),
      expenses: expenses.map(toExpense),
      conversations: convs,
      messages: msgs,
      agentEvents: deriveAgentEvents(msgs, convs),
      agentSettings: toAgentSettings(settings[0]),
      shopSettings: {
        openingCash: Number(shop[0].opening_cash),
        depositEnabled: shop[0].deposit_enabled as boolean,
        depositAmount: Number(shop[0].deposit_amount),
        depositHoldMin: Number(shop[0].deposit_hold_min),
        remindersEnabled: shop[0].reminders_enabled as boolean,
      },
      timeOff: timeOff.map((x) => ({
        id: x.id as string,
        staffId: x.staff_id as string,
        startsAt: isoOr(x.starts_at as Date),
        endsAt: isoOr(x.ends_at as Date),
        reason: (x.reason as string) ?? null,
      })),
      cashClosures: closures.map((c) => ({
        day: c.day as string,
        openingCash: Number(c.opening_cash),
        expectedCash: Number(c.expected_cash),
        countedCash: Number(c.counted_cash),
        closedAt: isoOr(c.closed_at as Date),
        notes: (c.notes as string) ?? null,
      })),
    }
  },

  async createAppointment({ appointment, newClient, linkConversationId }) {
    const sql = sqlClient()
    try {
      return await sql.begin(async (tx) => {
        let clientId = appointment.clientId
        if (!clientId) {
          if (!newClient) throw new Error("Falta el cliente del turno.")
          // El teléfono es único: si esa persona ya existe, se reusa su ficha.
          const [c] = await tx`
            insert into clients (name, phone, channel, notes, preferred_staff_id)
            values (${newClient.name}, ${newClient.phone}, ${newClient.channel}, ${newClient.notes}, ${newClient.preferredStaffId})
            on conflict (phone) do update set name = clients.name
            returning id`
          clientId = c.id as string
          if (linkConversationId) {
            await tx`update conversations set client_id = ${clientId} where id = ${linkConversationId} and client_id is null`
          }
        }
        const [a] = await tx`
          insert into appointments (client_id, staff_id, service_id, starts_at, ends_at, status, source, price, notes, conversation_id)
          values (${clientId}, ${appointment.staffId}, ${appointment.serviceId}, ${appointment.startsAt}, ${appointment.endsAt},
                  ${appointment.status}, ${appointment.source}, ${appointment.price}, ${appointment.notes}, ${appointment.conversationId})
          returning id`
        return { appointmentId: a.id as string, clientId }
      })
    } catch (e) {
      if (code(e) === "23P01") throw new SlotTakenError()
      throw e
    }
  },

  async updateAppointment(id, patch) {
    const row: Record<string, unknown> = {}
    if (patch.status !== undefined) row.status = patch.status
    if (patch.startsAt !== undefined) row.starts_at = patch.startsAt
    if (patch.endsAt !== undefined) row.ends_at = patch.endsAt
    if (patch.notes !== undefined) row.notes = patch.notes
    if (!Object.keys(row).length) return
    const sql = sqlClient()
    try {
      await sql`update appointments set ${sql(row)} where id = ${id}`
    } catch (e) {
      if (code(e) === "23P01") throw new SlotTakenError()
      throw e
    }
  },

  async chargeAppointment(appointmentId, p) {
    const sql = sqlClient()
    try {
      await sql.begin(async (tx) => {
        await tx`
          insert into payments (appointment_id, client_id, staff_id, service_id, concept, kind, list_price, discount,
                                discount_reason, tip, amount, method, paid_at)
          values (${appointmentId}, ${p.clientId}, ${p.staffId}, ${p.serviceId}, ${p.concept}, ${p.kind}, ${p.listPrice},
                  ${p.discount}, ${p.discountReason}, ${p.tip}, ${p.amount}, ${p.method}, ${p.paidAt})`
        await tx`update appointments set status = 'completado' where id = ${appointmentId}`
      })
    } catch (e) {
      if (code(e) === "23505") throw new AlreadyChargedError()
      throw e
    }
  },

  async addExpense(e) {
    const sql = sqlClient()
    await sql`insert into expenses (category, description, amount, method, paid_at)
              values (${e.category}, ${e.description}, ${e.amount}, ${e.method}, ${e.paidAt})`
  },

  async updateAgentSettings(patch) {
    const sql = sqlClient()
    const row: Record<string, unknown> = { updated_at: new Date() }
    if (patch.enabled !== undefined) row.enabled = patch.enabled
    if (patch.name !== undefined) row.name = patch.name
    if (patch.tone !== undefined) row.tone = patch.tone
    if (patch.channels !== undefined) row.channels = sql.json(patch.channels)
    if (patch.permissions !== undefined) row.permissions = sql.json(patch.permissions)
    if (patch.rules !== undefined) row.rules = patch.rules
    if (patch.afterHoursNote !== undefined) row.after_hours_note = patch.afterHoursNote
    await sql`update agent_settings set ${sql(row)} where id = 1`
  },

  async upsertConversation(c) {
    const sql = sqlClient()
    const digits = (c.participantHandle ?? "").replace(/\D/g, "")
    const [row] = await sql`
      insert into conversations (zernio_id, zernio_account_id, channel, participant_name, participant_handle, client_id)
      values (${c.externalId}, ${c.accountExternalId}, ${c.channel}, ${c.participantName}, ${c.participantHandle},
              ${digits.length >= 8
                ? sql`(select id from clients where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like ${"%" + digits.slice(-10)} limit 1)`
                : null})
      on conflict (zernio_id) do update set participant_name = coalesce(excluded.participant_name, conversations.participant_name)
      returning *`
    return toConversation(row)
  },

  async updateConversation(id, patch) {
    const row: Record<string, unknown> = {}
    if (patch.mode !== undefined) row.mode = patch.mode
    if (patch.needsHuman !== undefined) row.needs_human = patch.needsHuman
    if (patch.handoffReason !== undefined) row.handoff_reason = patch.handoffReason
    if (patch.unread !== undefined) row.unread = patch.unread
    if (patch.lastMessageAt !== undefined) row.last_message_at = patch.lastMessageAt
    if (patch.lastInboundAt !== undefined) row.last_inbound_at = patch.lastInboundAt
    if (patch.clientId !== undefined) row.client_id = patch.clientId
    if (!Object.keys(row).length) return
    const sql = sqlClient()
    await sql`update conversations set ${sql(row)} where id = ${id}`
  },

  async addMessage(m) {
    const sql = sqlClient()
    const rows = await sql`
      insert into messages (conversation_id, zernio_id, author, staff_id, body, action, action_ref, sent_at)
      values (${m.conversationId}, ${m.externalId ?? null}, ${m.author}, ${m.staffId}, ${m.body}, ${m.action}, ${m.actionRef}, ${m.sentAt})
      on conflict (zernio_id) do nothing
      returning id`
    return rows.length ? { id: rows[0].id as string } : null
  },

  async saveService({ id, name, category, durationMin, price, countsForLoyalty, active }) {
    const sql = sqlClient()
    if (id) {
      await sql`update services set name = ${name}, category = ${category}, duration_min = ${durationMin}, price = ${price},
                counts_for_loyalty = ${countsForLoyalty}, active = ${active} where id = ${id}`
      return id
    }
    const [row] = await sql`
      insert into services (name, category, duration_min, price, counts_for_loyalty, active, sort)
      values (${name}, ${category}, ${durationMin}, ${price}, ${countsForLoyalty}, ${active}, (select coalesce(max(sort), 0) + 1 from services))
      returning id`
    return row.id as string
  },

  async saveStaff({ id, name, role, commissionPct, active }) {
    const sql = sqlClient()
    if (id) {
      await sql`update staff set name = ${name}, role = ${role}, commission_pct = ${commissionPct}, active = ${active} where id = ${id}`
      return id
    }
    return sql.begin(async (tx) => {
      const [row] = await tx`insert into staff (name, role, commission_pct, active) values (${name}, ${role}, ${commissionPct}, ${active}) returning id`
      // Un barbero nuevo arranca con el horario del local (mar–sáb 11–20); después se ajusta.
      await tx`insert into staff_schedules (staff_id, weekday, start_time, end_time)
               select ${row.id}, d, '11:00', '20:00' from generate_series(2, 6) as d`
      return row.id as string
    })
  },

  async setStaffSchedule(staffId, shifts) {
    const sql = sqlClient()
    await sql.begin(async (tx) => {
      await tx`delete from staff_schedules where staff_id = ${staffId}`
      for (const s of shifts) {
        await tx`insert into staff_schedules (staff_id, weekday, start_time, end_time) values (${staffId}, ${s.weekday}, ${s.start}, ${s.end})`
      }
    })
  },

  async addTimeOff({ staffId, startsAt, endsAt, reason }) {
    const sql = sqlClient()
    await sql`insert into staff_time_off (staff_id, starts_at, ends_at, reason) values (${staffId}, ${startsAt}, ${endsAt}, ${reason})`
  },

  async removeTimeOff(id) {
    const sql = sqlClient()
    await sql`delete from staff_time_off where id = ${id}`
  },

  async updateShopSettings(patch) {
    const row: Record<string, unknown> = { updated_at: new Date() }
    if (patch.openingCash !== undefined) row.opening_cash = patch.openingCash
    if (patch.depositEnabled !== undefined) row.deposit_enabled = patch.depositEnabled
    if (patch.depositAmount !== undefined) row.deposit_amount = patch.depositAmount
    if (patch.depositHoldMin !== undefined) row.deposit_hold_min = patch.depositHoldMin
    if (patch.remindersEnabled !== undefined) row.reminders_enabled = patch.remindersEnabled
    const sql = sqlClient()
    await sql`update shop_settings set ${sql(row)} where id = 1`
  },

  async closeCashDay(c) {
    const sql = sqlClient()
    await sql`
      insert into cash_sessions (business_day, opened_at, opening_cash, expected_cash, counted_cash, closed_at, closed_by_name, notes)
      values (${c.day}, ${c.day + "T00:00:00-03:00"}, ${c.openingCash}, ${c.expectedCash}, ${c.countedCash}, ${c.closedAt}, 'Panel', ${c.notes})
      on conflict (business_day) do update set
        opening_cash = excluded.opening_cash, expected_cash = excluded.expected_cash,
        counted_cash = excluded.counted_cash, closed_at = excluded.closed_at, notes = excluded.notes`
  },

  async recordAgentRun(r) {
    const sql = sqlClient()
    await sql`
      insert into agent_runs (conversation_id, provider, model, ok, failure_reason, tools, input_tokens, output_tokens,
                              cache_read_tokens, cache_write_tokens, cost_usd)
      values (${r.conversationId}, ${r.provider}, ${r.model}, ${r.ok}, ${r.failureReason}, ${sql.json(r.tools)},
              ${r.usage.input}, ${r.usage.output}, ${r.usage.cacheRead}, ${r.usage.cacheWrite}, ${r.costUsd})`
  },
}
