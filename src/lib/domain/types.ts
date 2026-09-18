/**
 * Modelo de dominio de Virex. Espeja las tablas de
 * `supabase/migrations/0001_core.sql` en camelCase.
 *
 * Plata: pesos enteros (ARS sin centavos). Fechas: ISO 8601 en UTC; la
 * conversión a hora argentina vive en `src/lib/time.ts`.
 */

export type Channel = "whatsapp" | "instagram"

/** Por dónde entró el turno. Es la métrica que muestra cuánto trabaja el agente. */
export type AppointmentSource = "agente" | "panel" | "web" | "walk_in"

export type AppointmentStatus =
  | "pendiente" // reservado, sin confirmar (típico: lo tomó el agente fuera de horario)
  | "confirmado"
  | "en_curso"
  | "completado"
  | "cancelado"
  | "no_show"

export type PaymentMethod = "efectivo" | "transferencia" | "mercadopago" | "debito" | "credito"

export type StaffRole = "dueno" | "barbero" | "recepcion"

export interface Staff {
  id: string
  name: string
  role: StaffRole
  /** Parte del servicio que se lleva el barbero (0–100). El dueño va en 0. */
  commissionPct: number
  active: boolean
  /** Servicios que NO hace (ej. color). Vacío = hace todos. */
  skipsServiceIds: string[]
}

export type ServiceCategory = "corte" | "barba" | "combo" | "color" | "extra"

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  durationMin: number
  price: number
  /** ¿Suma un sello en la tarjeta de fidelidad? En Virex, sólo lo que incluye corte. */
  countsForLoyalty: boolean
  active: boolean
}

export interface Client {
  id: string
  name: string
  phone: string | null
  instagram: string | null
  /** Canal por el que suele escribir. */
  channel: Channel | null
  /** Notas de corte: "degradé bajo, 1,5 a los costados, tijera arriba". */
  cutNotes: string | null
  notes: string | null
  preferredStaffId: string | null
  createdAt: string
}

export interface Appointment {
  id: string
  clientId: string
  staffId: string
  serviceId: string
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  source: AppointmentSource
  /** Precio de lista al momento de reservar (el cobrado vive en Payment). */
  price: number
  notes: string | null
  conversationId: string | null
  createdAt: string
}

export type DiscountReason = "fidelidad" | "manual"

export interface Payment {
  id: string
  appointmentId: string | null
  clientId: string | null
  staffId: string | null
  serviceId: string | null
  /** Qué se cobró, en palabras: "Corte + barba", "Cera mate". */
  concept: string
  kind: "servicio" | "producto"
  listPrice: number
  discount: number
  discountReason: DiscountReason | null
  tip: number
  /** Total cobrado = listPrice − discount + tip. */
  amount: number
  method: PaymentMethod
  paidAt: string
}

export type ExpenseCategory =
  | "alquiler"
  | "servicios"
  | "insumos"
  | "sueldos"
  | "marketing"
  | "otros"

export interface Expense {
  id: string
  category: ExpenseCategory
  description: string
  amount: number
  method: PaymentMethod
  paidAt: string
}

/* ── Bandeja ── */

/** Quién responde la conversación. "ia" = el agente contesta solo. */
export type ConversationMode = "ia" | "humano"

export interface Conversation {
  id: string
  channel: Channel
  clientId: string | null
  participantName: string
  participantHandle: string | null
  mode: ConversationMode
  unread: number
  lastMessageAt: string
  /** Último mensaje del cliente: define la ventana de 24 h de WhatsApp. */
  lastInboundAt: string | null
  /** El agente pidió ayuda humana y todavía nadie la tomó. */
  needsHuman: boolean
  handoffReason: string | null
}

export type MessageAuthor = "cliente" | "ia" | "staff"

export interface Message {
  id: string
  conversationId: string
  author: MessageAuthor
  staffId: string | null
  body: string
  sentAt: string
  /** Acción que el agente ejecutó al enviar este mensaje (para mostrarla en el hilo). */
  action: AgentActionKind | null
  actionRef: string | null
}

export type AgentActionKind =
  | "turno_creado"
  | "turno_reprogramado"
  | "turno_cancelado"
  | "consulta_respondida"
  | "derivado_humano"
  | "sello_consultado"

export interface AgentEvent {
  id: string
  at: string
  kind: AgentActionKind
  channel: Channel
  conversationId: string
  summary: string
}

/* ── Agente ── */

export type AgentTone = "cercano" | "profesional" | "canchero"

export interface AgentSettings {
  enabled: boolean
  name: string
  tone: AgentTone
  channels: Record<Channel, boolean>
  permissions: {
    answerPrices: boolean
    book: boolean
    reschedule: boolean
    cancel: boolean
    shareLoyalty: boolean
  }
  /** Reglas del dueño en lenguaje natural. Van al system prompt. */
  rules: string[]
  /** Mensaje fuera de horario (el agente igual puede agendar). */
  afterHoursNote: string
}
