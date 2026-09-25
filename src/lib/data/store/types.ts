import type {
  AgentEvent,
  AgentSettings,
  Appointment,
  AppointmentStatus,
  CashClosure,
  Channel,
  Client,
  Conversation,
  Expense,
  Message,
  Payment,
  Service,
  ShopSettings,
  Staff,
  StaffRole,
  TimeOffEntry,
  WorkShift,
} from "@/lib/domain/types"

/**
 * La única puerta a los datos, con dos cerraduras intercambiables:
 *
 *   - `memory.ts`: la demo en memoria (datos generados por `seed.ts`). Sirve
 *     para desarrollar y testear sin base, y es la que usa la rama `demo`.
 *   - `postgres.ts`: la base real de Supabase.
 *
 * `repo.ts` elige una según haya o no `DATABASE_URL`. Las pantallas, las
 * server actions y el agente sólo conocen esta interfaz: no saben (ni les
 * importa) de dónde salen los datos.
 */

/** Todo lo que las pantallas leen para armar una vista. Sólo lectura. */
export interface Snapshot {
  /** Instante que la app considera "ahora" (en la demo puede estar simulado). */
  now: string
  simulated: boolean
  staff: Staff[]
  services: Service[]
  clients: Client[]
  appointments: Appointment[]
  payments: Payment[]
  expenses: Expense[]
  conversations: Conversation[]
  messages: Message[]
  agentEvents: AgentEvent[]
  agentSettings: AgentSettings
  shopSettings: ShopSettings
  /** Francos con motivo, para Ajustes. (Cada barbero trae además los suyos sin motivo, para los horarios.) */
  timeOff: TimeOffEntry[]
  /** Cierres de caja de los últimos 400 días. */
  cashClosures: CashClosure[]
}

export type ServiceInput = Omit<Service, "id"> & { id?: string }

export interface StaffInput {
  id?: string
  name: string
  role: StaffRole
  commissionPct: number
  active: boolean
}

export type NewClient = Pick<Client, "name" | "phone" | "channel" | "notes" | "preferredStaffId">

export type NewAppointment = Omit<Appointment, "id" | "createdAt"> & { createdAt?: string }

export type AppointmentPatch = Partial<Pick<Appointment, "status" | "startsAt" | "endsAt" | "notes">>

export type NewPayment = Omit<Payment, "id">

export type NewExpense = Omit<Expense, "id">

export type ConversationPatch = Partial<
  Pick<Conversation, "mode" | "needsHuman" | "handoffReason" | "unread" | "lastMessageAt" | "lastInboundAt" | "clientId">
>

export type NewMessage = Omit<Message, "id"> & {
  /** Id del mensaje en Zernio: si ya existe, no se inserta de nuevo (reintentos del webhook). */
  externalId?: string | null
}

export interface IncomingConversation {
  externalId: string
  accountExternalId: string
  channel: Channel
  participantName: string
  participantHandle: string | null
}

export interface AgentRunRecord {
  conversationId: string | null
  provider: string
  model: string
  ok: boolean
  failureReason: string | null
  tools: { tool: string; action?: string; isError?: boolean }[]
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number }
  costUsd: number | null
}

/**
 * Errores que la base convierte en reglas. Se lanzan con estos nombres para
 * que la capa de arriba muestre un mensaje claro sin conocer códigos de SQL.
 */
export class SlotTakenError extends Error {
  name = "SlotTakenError"
}
export class AlreadyChargedError extends Error {
  name = "AlreadyChargedError"
}

export interface Store {
  readonly kind: "memory" | "postgres"

  snapshot(): Promise<Snapshot>
  now(): Promise<Date>

  /** Crea el turno (y el cliente, si viene `newClient`) en una sola operación. Lanza SlotTakenError. */
  createAppointment(input: {
    appointment: Omit<NewAppointment, "clientId"> & { clientId?: string }
    newClient?: NewClient
    /** Si el turno lo tomó el agente: asocia el cliente nuevo a esa conversación. */
    linkConversationId?: string | null
  }): Promise<{ appointmentId: string; clientId: string }>

  /** Lanza SlotTakenError si el nuevo horario choca. */
  updateAppointment(id: string, patch: AppointmentPatch): Promise<void>

  /** Registra el cobro y deja el turno completado, juntos. Lanza AlreadyChargedError. */
  chargeAppointment(appointmentId: string, payment: NewPayment): Promise<void>

  addExpense(expense: NewExpense): Promise<void>

  updateAgentSettings(patch: Partial<AgentSettings>): Promise<void>

  /** Busca la conversación por su id en Zernio; si no existe, la crea. */
  upsertConversation(incoming: IncomingConversation): Promise<Conversation>

  updateConversation(id: string, patch: ConversationPatch): Promise<void>

  /** Devuelve null si el mensaje ya estaba (mismo externalId). */
  addMessage(message: NewMessage): Promise<{ id: string } | null>

  recordAgentRun(run: AgentRunRecord): Promise<void>

  /* ── Ajustes ── */
  /** Crea (sin id) o actualiza un servicio. Devuelve el id. */
  saveService(service: ServiceInput): Promise<string>
  /** Crea (sin id, con el horario del local por defecto) o actualiza un barbero. Devuelve el id. */
  saveStaff(member: StaffInput): Promise<string>
  /** Reemplaza el horario semanal completo de un barbero. */
  setStaffSchedule(staffId: string, shifts: WorkShift[]): Promise<void>
  addTimeOff(entry: Omit<TimeOffEntry, "id">): Promise<void>
  removeTimeOff(id: string): Promise<void>
  updateShopSettings(patch: Partial<ShopSettings>): Promise<void>

  /** Guarda (o corrige) el cierre de caja de ese día. */
  closeCashDay(closure: CashClosure): Promise<void>
}

export type { AppointmentStatus }
