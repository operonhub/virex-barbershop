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
  /**
   * Horario propio por día de la semana. `undefined` = sigue el horario del
   * local (la demo). Con la base, un día sin franjas = ese día no trabaja.
   */
  schedule?: WorkShift[]
  /** Francos, vacaciones, turnos médicos: rangos en que no atiende. Sin motivo (puede llegar a la web pública). */
  timeOff?: { startsAt: string; endsAt: string }[]
}

/** Configuración del local editable desde Ajustes (tabla `shop_settings`). */
export interface ShopSettings {
  /** Efectivo con el que abre la caja cada día. */
  openingCash: number
  depositEnabled: boolean
  depositAmount: number
  depositHoldMin: number
  remindersEnabled: boolean
  /** Cada cuántos minutos se ofrece un horario (30, 45 o 60). La duración de cada turno es la del servicio. */
  slotStepMin: number
}

/** Cierre de caja de un día (uno por día; corregir lo actualiza). */
export interface CashClosure {
  /** AAAA-MM-DD, hora argentina. */
  day: string
  openingCash: number
  expectedCash: number
  countedCash: number
  closedAt: string
  notes: string | null
}

/** Franco, vacaciones o bloqueo, con el motivo (sólo para el panel). */
export interface TimeOffEntry {
  id: string
  staffId: string
  startsAt: string
  endsAt: string
  reason: string | null
}

/**
 * Turno fijo: un horario reservado de forma permanente (todas las semanas) o
 * un día puntual. Bloquea la silla como un franco, sin ser un turno (no tiene
 * cliente ni cobro). Es semanal si tiene `weekday`, de un día si tiene `onDate`.
 */
export interface FixedSlot {
  id: string
  staffId: string
  /** 0 = domingo … 6 = sábado. Sólo en los semanales. */
  weekday: number | null
  /** AAAA-MM-DD. Sólo en los de un día. */
  onDate: string | null
  /** "HH:MM" */
  start: string
  end: string
  /** Para el equipo ("Juan, corte y barba"). El agente no lo ve. */
  label: string | null
  active: boolean
}

export interface WorkShift {
  /** 0 = domingo … 6 = sábado. */
  weekday: number
  /** "HH:MM" */
  start: string
  end: string
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
  /**
   * Vencimiento de la seña reservada (Mercado Pago). Sólo en turnos
   * "pendiente" creados con seña: pasado este momento sin pagar, se cancela
   * solo (la base libera la silla). `null` en cualquier otro turno.
   */
  holdExpiresAt: string | null
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
  /** "sena" = seña de Mercado Pago al reservar; se descuenta del cobro final. */
  kind: "servicio" | "producto" | "sena"
  listPrice: number
  discount: number
  discountReason: DiscountReason | null
  tip: number
  /** Total cobrado = listPrice − discount + tip. */
  amount: number
  method: PaymentMethod
  paidAt: string
  /** Id del pago en Mercado Pago (dedupe del webhook). Sólo en pagos de "sena". */
  externalRef?: string | null
  /** Cuántos cortes representa. 1 en un cobro normal; en el historial importado del Excel, la cantidad del día. */
  units?: number
  /** true si viene del Excel de antes del panel (sin turno ni cliente detrás). */
  imported?: boolean
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
  /** true si viene del Excel de antes del panel. */
  imported?: boolean
}

/* ── Bandeja ── */

/** Quién responde la conversación. "ia" = el agente contesta solo. */
export type ConversationMode = "ia" | "humano"

export interface Conversation {
  id: string
  /** Id de la conversación en Zernio (para responder). En la demo coincide con `id`. */
  externalId?: string | null
  /** Cuenta de Zernio (el WhatsApp o el Instagram del local) por la que entró. */
  accountExternalId?: string | null
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
