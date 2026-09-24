import { BRAND } from "@/config/brand"
import { freeSlots, isOpen } from "@/lib/domain/slots"
import { loyaltyStatus } from "@/lib/domain/loyalty"
import {
  addDays,
  at,
  dayKey,
  hm,
  hmToMinutes,
  minutesOfDay,
  minutesToHm,
  weekday,
} from "@/lib/time"
import type {
  AgentEvent,
  AgentSettings,
  Appointment,
  AppointmentStatus,
  Channel,
  Client,
  Conversation,
  Expense,
  Message,
  Payment,
  PaymentMethod,
  Service,
  Staff,
} from "@/lib/domain/types"

/**
 * Datos de demostración.
 *
 * Realistas a propósito: son los que va a ver el dueño de Virex el domingo,
 * y un panel con "Cliente 1 / $100" no vende. Se generan relativos al reloj
 * de la demo, así el panel siempre parece de hoy, y con una semilla por día:
 * mismo día → mismos datos (el server y el navegador coinciden).
 *
 * ⚠ Barberos, precios y duraciones son SUPUESTOS a confirmar con el cliente.
 * Lo único tomado de la realidad: dirección, horario (Mar–Sáb 11–20) y la
 * tarjeta de fidelidad 5 + 1 al 50 %.
 */

/** Subirlo al cambiar el generador: invalida el estado demo guardado en memoria. */
export const SEED_VERSION = 5

export interface DemoState {
  /** Instante que la demo considera "ahora". Ver `demoClock`. */
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
}

/* ── Reloj ────────────────────────────────────────────────────────────── */

/**
 * Si se abre la demo con el local cerrado (un domingo, a la noche) el panel
 * de "Hoy" quedaría vacío. En ese caso se simula el último día hábil a las
 * 16:40 — plena tarde — y la barra superior lo avisa. `DEMO_CLOCK=real`
 * desactiva la simulación.
 */
export function demoClock(real = new Date()): { now: Date; simulated: boolean } {
  if (process.env.DEMO_CLOCK === "real") return { now: real, simulated: false }
  const today = dayKey(real)
  const m = minutesOfDay(real)
  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)
  if (isOpen(today) && m >= open + 30 && m <= close) return { now: real, simulated: false }

  let day = today
  for (let i = 0; i < 8; i++) {
    const candidate = at(day, "16:40")
    if (isOpen(day) && candidate <= real) return { now: candidate, simulated: true }
    day = addDays(day, -1)
  }
  return { now: real, simulated: false }
}

/* ── Azar determinístico ──────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/* ── Catálogo ─────────────────────────────────────────────────────────── */

export const STAFF: Staff[] = [
  // Barberos reales (24/09). Quién es el dueño y las comisiones son supuestos a confirmar.
  { id: "st-santiago", name: "Santiago", role: "dueno", commissionPct: 0, active: true, skipsServiceIds: [] },
  { id: "st-sebastian", name: "Sebastián", role: "barbero", commissionPct: 50, active: true, skipsServiceIds: [] },
  { id: "st-nehemias", name: "Nehemías", role: "barbero", commissionPct: 50, active: true, skipsServiceIds: [] },
]

export const SERVICES: Service[] = [
  // Servicios y precios reales (24/09). Todos los turnos duran una hora.
  { id: "sv-corte", name: "Corte", category: "corte", durationMin: 60, price: 15000, countsForLoyalty: true, active: true },
  { id: "sv-corte-barba", name: "Corte + barba", category: "combo", durationMin: 60, price: 20000, countsForLoyalty: true, active: true },
]

const PRODUCTS: [string, number][] = [
  ["Cera mate", 9500],
  ["Pomada brillo", 9000],
  ["Aceite para barba", 11000],
  ["Polvo texturizador", 10500],
]

const FIRST = [
  "Matías", "Lucas", "Franco", "Ezequiel", "Nahuel", "Tomás", "Gonzalo", "Kevin", "Joaquín",
  "Facundo", "Agustín", "Santiago", "Nicolás", "Lautaro", "Valentín", "Ramiro", "Maximiliano",
  "Brian", "Axel", "Iván", "Emiliano", "Damián", "Leandro", "Cristian", "Rodrigo", "Hernán",
  "Julián", "Mauro", "Alan", "Gastón", "Ulises", "Benjamín", "Juan Cruz", "Mateo", "Ian",
  "Luciano", "Federico", "Gabriel", "Pablo", "Diego", "Marcos", "Sebastián", "Alejo", "Enzo",
  "Dylan", "Elías", "Fabricio", "Germán", "Ignacio", "Jeremías", "Lisandro", "Martín", "Milo",
  "Octavio", "Patricio", "Rafael", "Simón", "Tobías", "Uriel", "Bautista",
]
const LAST = [
  "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "Sosa", "Romero",
  "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera",
  "Suárez", "Aguirre", "Giménez", "Gutiérrez", "Pereyra", "Molina", "Castro", "Ortiz", "Silva",
  "Núñez", "Luna", "Juárez", "Cabrera", "Ríos", "Morales", "Godoy", "Ledesma", "Vega",
]

const CUT_NOTES = [
  "Degradé bajo, 1,5 a los costados, tijera arriba",
  "Mid fade con raya marcada del lado izquierdo",
  "Burst fade, arriba texturizado con polvo",
  "Taper en la nuca, no tocar el largo de arriba",
  "Cero a los costados, barba perfilada a navaja",
  "Crop francés, flequillo corto y recto",
]

/* ── Generador ────────────────────────────────────────────────────────── */

const PAST_DAYS = 70
const FUTURE_DAYS = 10

export function buildDemo(real = new Date()): DemoState {
  const clock = demoClock(real)
  const now = clock.now
  const today = dayKey(now)
  const nowMin = minutesOfDay(now)
  const rand = mulberry32(hashString(`virex:${today}`))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
  const chance = (p: number) => rand() < p
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString()

  let seq = 0
  const id = (prefix: string) => `${prefix}-${(++seq).toString(36)}`

  /* Clientes */
  const clients: Client[] = []
  const usedNames = new Set<string>()
  for (let i = 0; clients.length < 440; i++) {
    const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`
    if (usedNames.has(name)) continue
    usedNames.add(name)
    const channel: Channel = chance(0.68) ? "whatsapp" : "instagram"
    const handle = name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    clients.push({
      id: `cl-${clients.length + 1}`,
      name,
      phone: `+54911${String(40000000 + Math.floor(rand() * 59999999)).slice(0, 8)}`,
      instagram: channel === "instagram" || chance(0.3) ? `${handle}.${pick(["fdz", "07", "ok", "rz", "cuts", "10"])}` : null,
      channel,
      cutNotes: clients.length < 80 ? pick(CUT_NOTES) : null,
      notes: null,
      preferredStaffId: clients.length < 80 ? pick(STAFF).id : null,
      createdAt: minutesAgo(60 * 24 * (80 + Math.floor(rand() * 400))),
    })
  }
  const byFirstName = (first: string) => clients.find((c) => c.name.startsWith(first + " "))!
  clients[0].notes = "Viene cada 2 semanas, siempre los viernes."
  byFirstName("Ezequiel").notes = "Reclamo por corte desparejo (ver Bandeja)."

  /* Turnos */
  const appointments: Appointment[] = []
  const svc = (sid: string) => SERVICES.find((s) => s.id === sid)!
  // Índice de ocupación por día+barbero: consultar `freeSlots` en cada
  // intento recorrería todos los turnos con Intl y el seed tardaría segundos.
  const busyIndex = new Map<string, [number, number][]>()
  const isFree = (day: string, staffId: string, start: number, end: number) =>
    !(busyIndex.get(`${day}|${staffId}`) ?? []).some(([s, e]) => start < e && end > s)

  function book(
    day: string,
    time: string,
    staffId: string,
    serviceId: string,
    clientId: string,
    extra: Partial<Appointment> = {}
  ) {
    const s = svc(serviceId)
    const start = at(day, time)
    const appt: Appointment = {
      id: id("tu"),
      clientId,
      staffId,
      serviceId,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + s.durationMin * 60_000).toISOString(),
      status: "confirmado",
      source: "panel",
      price: s.price,
      notes: null,
      conversationId: null,
      createdAt: minutesAgo(60 * 24 * 3),
      ...extra,
    }
    appointments.push(appt)
    if (appt.status !== "cancelado" && appt.status !== "no_show") {
      const key = `${day}|${staffId}`
      const t0 = hmToMinutes(time)
      busyIndex.set(key, [...(busyIndex.get(key) ?? []), [t0, t0 + s.durationMin]])
    }
    return appt
  }

  const nextOpen = (from: string) => {
    let d = addDays(from, 1)
    while (!isOpen(d)) d = addDays(d, 1)
    return d
  }
  const tomorrowOpen = nextOpen(today)
  const nextSaturday = (() => {
    let d = addDays(today, 1)
    while (weekday(d) !== 6) d = addDays(d, 1)
    return d
  })()

  // Turnos que cuentan una historia en la Bandeja: se reservan primero para
  // que el relleno al azar no les pise el horario.
  const matias = clients[0]
  const franco = byFirstName("Franco")
  const bautista = byFirstName("Bautista")
  const story = {
    matias: book(tomorrowOpen, "18:00", "st-nehemias", "sv-corte-barba", matias.id, {
      source: "agente",
      status: "confirmado",
      conversationId: "cv-matias",
      createdAt: minutesAgo(30),
    }),
    franco: book(today, "19:00", "st-sebastian", "sv-corte", franco.id, {
      source: "agente",
      conversationId: "cv-franco",
      createdAt: minutesAgo(60 * 24 * 2),
      notes: "Reprogramado por el agente (antes 17:00).",
    }),
    bauti: book(nextSaturday, "11:00", "st-santiago", "sv-corte", bautista.id, {
      source: "agente",
      status: "pendiente",
      conversationId: "cv-bauti",
      createdAt: minutesAgo(258),
    }),
  }

  // Tres grupos, con frecuencias de barbería real: ~80 habituales que vienen
  // cada dos semanas, ~340 ocasionales (una vez por mes o menos) y 20 que
  // venían seguido y dejaron de venir hace más de un mes — los que aparecen
  // en "Volver a llamar".
  const regulars = clients.slice(0, 80)
  const lapsed = clients.slice(80, 100)
  const occasional = clients.slice(100)
  // Los protagonistas de la Bandeja ya tienen su turno futuro armado por la
  // historia: el relleno al azar no les agrega otro que la contradiga.
  const storyIds = new Set([matias.id, franco.id, bautista.id])
  const pickClient = (off: number): Client => {
    const c =
      off < -40 && chance(0.12) ? pick(lapsed) : chance(0.31) ? pick(regulars) : pick(occasional)
    return off >= 0 && storyIds.has(c.id) ? pickClient(off) : c
  }

  const SERVICE_WEIGHTS: [string, number][] = [
    ["sv-corte", 62],
    ["sv-corte-barba", 38],
  ]
  const totalWeight = SERVICE_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  const pickService = (staff: Staff) => {
    for (;;) {
      let r = rand() * totalWeight
      for (const [sid, w] of SERVICE_WEIGHTS) {
        if ((r -= w) <= 0) {
          if (!staff.skipsServiceIds.includes(sid)) return svc(sid)
          break
        }
      }
    }
  }

  const BUSY: Record<number, number> = { 2: 0.52, 3: 0.58, 4: 0.66, 5: 0.8, 6: 0.9 }
  const open = hmToMinutes(BRAND.openingHours.open)
  const close = hmToMinutes(BRAND.openingHours.close)

  for (let off = -PAST_DAYS; off <= FUTURE_DAYS; off++) {
    const day = addDays(today, off)
    if (!isOpen(day)) continue
    const future = off > 0 ? Math.max(0.12, 0.62 - off * 0.09) : 1
    const busyness = BUSY[weekday(day)] * future

    for (const staff of STAFF) {
      let t = open + (chance(0.5) ? 0 : 15)
      while (t < close) {
        if (!chance(busyness)) {
          t += pick([15, 30, 45])
          continue
        }
        const s = pickService(staff)
        if (t + s.durationMin > close) break
        const start = minutesToHm(t)
        if (!isFree(day, staff.id, t, t + s.durationMin)) {
          t += 15
          continue
        }

        let status: AppointmentStatus = "confirmado"
        if (off < 0) status = chance(0.05) ? "no_show" : chance(0.05) ? "cancelado" : "completado"
        else if (off === 0) {
          if (t + s.durationMin <= nowMin) status = chance(0.04) ? "no_show" : "completado"
          else if (t <= nowMin) status = "en_curso"
          else status = chance(0.78) ? "confirmado" : "pendiente"
        } else status = chance(0.75) ? "confirmado" : "pendiente"

        const source =
          off <= 0 && chance(0.22)
            ? "walk_in"
            : pick(["agente", "agente", "agente", "panel", "panel", "web"] as const)

        const createdDaysBefore = source === "walk_in" ? 0 : 1 + Math.floor(rand() * 5)
        let created = at(day, start).getTime() - createdDaysBefore * 86_400_000
        // Un turno nunca puede haberse creado en el futuro: los de los
        // próximos días se reservaron, como muy tarde, anoche.
        if (created > now.getTime()) created = now.getTime() - (60 * 18 + rand() * 60 * 24 * 3) * 60_000
        const createdAt =
          off >= 0 && off <= 4 && source === "agente" && chance(0.07)
            ? minutesAgo(20 + Math.floor(rand() * 600)) // tomados hoy por el agente
            : new Date(created).toISOString()

        book(day, start, staff.id, s.id, pickClient(off).id, { status, source, createdAt })
        t += s.durationMin + (chance(0.3) ? 5 : 0)
      }
    }
  }
  appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  /* Cobros (con la tarjeta de fidelidad aplicada de verdad) */
  const payments: Payment[] = []
  const stamps = new Map<string, number>()
  const METHOD_WEIGHTS: [PaymentMethod, number][] = [
    ["efectivo", 38],
    ["transferencia", 32],
    ["mercadopago", 18],
    ["debito", 8],
    ["credito", 4],
  ]
  const pickMethod = () => {
    let r = rand() * 100
    for (const [m, w] of METHOD_WEIGHTS) if ((r -= w) <= 0) return m
    return "efectivo"
  }

  for (const a of appointments) {
    if (a.status !== "completado") continue
    const s = svc(a.serviceId)
    let discount = 0
    let discountReason: Payment["discountReason"] = null
    if (s.countsForLoyalty) {
      const n = stamps.get(a.clientId) ?? 0
      if (n >= BRAND.loyalty.stampsRequired) {
        discount = Math.round((s.price * BRAND.loyalty.rewardDiscountPct) / 100)
        discountReason = "fidelidad"
        stamps.set(a.clientId, 0)
      } else stamps.set(a.clientId, n + 1)
    }
    const tip = chance(0.16) ? pick([1000, 1500, 2000, 3000]) : 0
    const method = pickMethod()
    payments.push({
      id: id("co"),
      appointmentId: a.id,
      clientId: a.clientId,
      staffId: a.staffId,
      serviceId: s.id,
      concept: s.name,
      kind: "servicio",
      listPrice: s.price,
      discount,
      discountReason,
      tip,
      amount: s.price - discount + tip,
      method,
      paidAt: a.endsAt,
    })
    if (chance(0.09)) {
      const [concept, price] = pick(PRODUCTS)
      payments.push({
        id: id("co"),
        appointmentId: null,
        clientId: a.clientId,
        staffId: a.staffId,
        serviceId: null,
        concept,
        kind: "producto",
        listPrice: price,
        discount: 0,
        discountReason: null,
        tip: 0,
        amount: price,
        method,
        paidAt: new Date(new Date(a.endsAt).getTime() + 60_000).toISOString(),
      })
    }
  }

  /* Gastos fijos de los últimos tres meses */
  const expenses: Expense[] = []
  const EXPENSES: [number, Expense["category"], string, number, PaymentMethod][] = [
    [2, "alquiler", "Alquiler del local", 650000, "transferencia"],
    [4, "insumos", "Hojas, capas, alcohol y toallas", 118000, "transferencia"],
    [8, "insumos", "Productos para reventa (ceras, pomadas)", 180000, "transferencia"],
    [10, "servicios", "Luz y gas", 92000, "debito"],
    [12, "servicios", "Internet y teléfono", 31000, "debito"],
    [15, "marketing", "Publicidad en Instagram", 60000, "credito"],
    [19, "insumos", "Reposición de insumos", 96000, "efectivo"],
    [22, "otros", "Limpieza del local", 40000, "efectivo"],
  ]
  for (let back = 0; back <= 2; back++) {
    const [y, m] = today.slice(0, 7).split("-").map(Number)
    const d = new Date(Date.UTC(y, m - 1 - back, 1))
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    for (const [dd, category, description, amount, method] of EXPENSES) {
      const when = at(`${month}-${String(dd).padStart(2, "0")}`, "10:00")
      if (when > now) continue
      expenses.push({ id: id("ga"), category, description, amount, method, paidAt: when.toISOString() })
    }
  }

  /* Bandeja */
  const conversations: Conversation[] = []
  const messages: Message[] = []
  const agentEvents: AgentEvent[] = []

  const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
  const relDay = (day: string) =>
    day === today ? "hoy" : day === addDays(today, 1) ? "mañana" : `el ${DAY_NAMES[weekday(day)]}`

  function thread(
    conv: Omit<Conversation, "lastMessageAt" | "lastInboundAt">,
    lines: [minAgo: number, author: Message["author"], body: string, action?: Message["action"], staffId?: string][]
  ) {
    let lastAt = ""
    let lastIn: string | null = null
    for (const [ago, author, body, action, staffId] of lines) {
      const sentAt = minutesAgo(ago)
      messages.push({
        id: id("ms"),
        conversationId: conv.id,
        author,
        staffId: staffId ?? null,
        body,
        sentAt,
        action: action ?? null,
        actionRef: null,
      })
      if (action) {
        agentEvents.push({
          id: id("ev"),
          at: sentAt,
          kind: action,
          channel: conv.channel,
          conversationId: conv.id,
          summary: summaryFor(action, conv.participantName),
        })
      }
      lastAt = sentAt
      if (author === "cliente") lastIn = sentAt
    }
    conversations.push({ ...conv, lastMessageAt: lastAt, lastInboundAt: lastIn })
  }

  function summaryFor(kind: Message["action"], who: string) {
    switch (kind) {
      case "turno_creado":
        return `Agendó un turno para ${who}`
      case "turno_reprogramado":
        return `Reprogramó el turno de ${who}`
      case "turno_cancelado":
        return `Canceló el turno de ${who}`
      case "derivado_humano":
        return `Derivó a ${who} a una persona`
      case "sello_consultado":
        return `Le informó los sellos a ${who}`
      default:
        return `Respondió una consulta de ${who}`
    }
  }

  const slotsToday = STAFF.flatMap((s) =>
    freeSlots({ day: today, service: svc("sv-corte"), staff: s, appointments, now }).slice(0, 1).map((t) => ({ t, s }))
  ).sort((a, b) => a.t.localeCompare(b.t))
  const offerToday = slotsToday.length
    ? `Hoy me quedan ${slotsToday.map(({ t, s }) => `${t} con ${s.name}`).join(", ")}. ¿Te reservo alguno?`
    : `Hoy ya estamos completos 😕 ${relDay(tomorrowOpen)} tengo lugar desde las 11:00. ¿Te sirve?`

  const gonzalo = byFirstName("Gonzalo")
  const gStatus = loyaltyStatus(gonzalo.id, payments, SERVICES)
  const gonzaloReply = gStatus.rewardReady
    ? `¡Tenés la tarjeta completa, Gonza! 🎉 Tu próximo corte sale al 50%. ¿Te busco turno?`
    : `Tenés ${gStatus.stamps} de ${gStatus.required} sellos, Gonza. Te faltan ${gStatus.required - gStatus.stamps} y el siguiente corte te sale al 50% ✨`

  thread(
    { id: "cv-kevin", channel: "whatsapp", clientId: byFirstName("Kevin").id, participantName: byFirstName("Kevin").name, participantHandle: null, mode: "ia", unread: 1, needsHuman: false, handoffReason: null },
    [[2, "cliente", "Buenas! hasta qué hora están hoy?"]]
  )
  thread(
    { id: "cv-nahuel", channel: "instagram", clientId: byFirstName("Nahuel").id, participantName: byFirstName("Nahuel").name, participantHandle: "nahuu.07", mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [7, "cliente", "tienen turno hoy?"],
      [7, "ia", `¡Hola Nahuel! Para Corte: ${offerToday}`, "consulta_respondida"],
    ]
  )
  thread(
    { id: "cv-ezequiel", channel: "whatsapp", clientId: byFirstName("Ezequiel").id, participantName: byFirstName("Ezequiel").name, participantHandle: null, mode: "humano", unread: 2, needsHuman: true, handoffReason: "Reclamo por un corte" },
    [
      [26, "cliente", "Hola, el corte de ayer me quedó desparejo del lado izquierdo, se nota bastante"],
      [26, "ia", "Uh Ezequiel, lamento mucho eso. Ya le aviso a Santiago para que lo vea personalmente y te escriba en un rato para solucionarlo. 🙏", "derivado_humano"],
      [21, "cliente", "ok espero"],
      [9, "cliente", "?"],
    ]
  )
  thread(
    { id: "cv-matias", channel: "whatsapp", clientId: matias.id, participantName: matias.name, participantHandle: null, mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [39, "cliente", `Buenas! tenés turno para ${relDay(tomorrowOpen)} a la tarde? corte y barba`],
      [38, "ia", `¡Hola Matías! 👋 ${relDay(tomorrowOpen)[0].toUpperCase() + relDay(tomorrowOpen).slice(1)} para Corte + barba tengo 17:00 con Sebastián, 18:00 con Nehemías o 19:00 con Santiago. ¿Cuál te queda mejor?`, "consulta_respondida"],
      [32, "cliente", "18 con nehe"],
      [31, "ia", `Listo ✂️ Te agendé Corte + barba ${relDay(tomorrowOpen)} a las 18:00 con Nehemías. Te escribo una hora antes para recordártelo. ¡Te esperamos en Oncativo 2022!`, "turno_creado"],
      [30, "cliente", "genial gracias"],
    ]
  )
  thread(
    { id: "cv-tomi", channel: "instagram", clientId: null, participantName: "Tomi Fernández", participantHandle: "tomi.fdz", mode: "humano", unread: 1, needsHuman: true, handoffReason: "Pregunta por platinado: no está en la lista de servicios" },
    [
      [96, "cliente", "Hola! hacen platinado? tengo el pelo bastante oscuro"],
      [95, "ia", "¡Hola Tomi! Por ahora en el local hacemos corte y corte + barba. Igual le paso tu consulta a Santiago para que te responda él 🙌", "derivado_humano"],
      [13, "cliente", "dale, le mando una foto?"],
    ]
  )
  thread(
    { id: "cv-franco", channel: "whatsapp", clientId: franco.id, participantName: franco.name, participantHandle: null, mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [142, "cliente", "che hoy no llego a las 17, se puede más tarde?"],
      [141, "ia", "Sin drama, Franco. Te lo pasé a las 19:00 con Sebastián, mismo servicio (Corte). ¿Te sirve?", "turno_reprogramado"],
      [124, "cliente", "joya gracias"],
      [123, "ia", "¡De nada! Te esperamos 💈"],
    ]
  )
  thread(
    { id: "cv-lucas", channel: "whatsapp", clientId: byFirstName("Lucas").id, participantName: byFirstName("Lucas").name, participantHandle: null, mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [205, "cliente", "aceptan mercado pago?"],
      [205, "ia", "¡Sí! Aceptamos efectivo, transferencia, Mercado Pago y débito o crédito. 🙌", "consulta_respondida"],
    ]
  )
  thread(
    { id: "cv-bauti", channel: "whatsapp", clientId: bautista.id, participantName: "Carla (mamá de Bauti)", participantHandle: null, mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [262, "cliente", "Hola! quería sacar turno para mi hijo de 8 años, el sábado a la mañana"],
      [261, "ia", "¡Hola Carla! El sábado a las 11:00 tengo lugar con Santiago para un corte ($15.000, una hora). ¿Lo reservo a nombre de Bautista?"],
      [255, "cliente", "si porfa"],
      [254, "ia", `Listo, quedó reservado el sábado a las 11:00 con Santiago para Bautista ✂️ Te lo confirmo el viernes por este chat.`, "turno_creado"],
    ]
  )
  thread(
    { id: "cv-gonzalo", channel: "whatsapp", clientId: gonzalo.id, participantName: gonzalo.name, participantHandle: null, mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [300, "cliente", "cuántos cortes me faltan para el 50%?"],
      [300, "ia", gonzaloReply, "sello_consultado"],
    ]
  )
  thread(
    { id: "cv-santi", channel: "instagram", clientId: byFirstName("Santiago").id, participantName: byFirstName("Santiago").name, participantHandle: "santi.cuts", mode: "ia", unread: 0, needsHuman: false, handoffReason: null },
    [
      [340, "cliente", "🔥🔥🔥 quedó terrible el corte"],
      [339, "ia", "¡Gracias crack! 🙌 Cuando quieras repetir, escribinos y te buscamos turno."],
    ]
  )
  thread(
    { id: "cv-joaquin", channel: "whatsapp", clientId: byFirstName("Joaquín").id, participantName: byFirstName("Joaquín").name, participantHandle: null, mode: "humano", unread: 0, needsHuman: false, handoffReason: null },
    [
      [60 * 26, "cliente", "Santi, el sábado podés a las 12? es para mi casamiento, quiero algo prolijo"],
      [60 * 25, "staff", "Joaco, te guardé el sábado 12:00 👌 Vení con el pelo lavado y hacemos corte + barba a navaja.", undefined, "st-santiago"],
      [60 * 25 - 5, "cliente", "crack, gracias!"],
    ]
  )

  // Eventos del agente que no dejaron conversación en la demo: los turnos que
  // tomó hoy. Alimentan el contador "agendó N turnos hoy".
  for (const a of appointments) {
    if (a.source !== "agente" || a.conversationId || dayKey(a.createdAt) !== today) continue
    const c = clients.find((x) => x.id === a.clientId)!
    agentEvents.push({
      id: id("ev"),
      at: a.createdAt,
      kind: "turno_creado",
      channel: c.channel ?? "whatsapp",
      conversationId: "",
      summary: `Agendó ${svc(a.serviceId).name} a ${c.name.split(" ")[0]} · ${relDay(dayKey(a.startsAt))} ${hm(a.startsAt)}`,
    })
  }
  agentEvents.sort((a, b) => b.at.localeCompare(a.at))
  conversations.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))

  void story

  return {
    now: now.toISOString(),
    simulated: clock.simulated,
    staff: STAFF,
    services: SERVICES,
    clients,
    appointments,
    payments,
    expenses,
    conversations,
    messages,
    agentEvents,
    agentSettings: {
      enabled: true,
      name: "Asistente Virex",
      tone: "cercano",
      channels: { whatsapp: true, instagram: true },
      permissions: {
        answerPrices: true,
        book: true,
        reschedule: true,
        cancel: true,
        shareLoyalty: true,
      },
      rules: [
        "Nunca inventes descuentos ni promociones que no existen.",
        "Por ahora el local hace sólo corte y corte + barba. Si piden otra cosa (color, diseño, barba sola), decilo y derivá a Santiago.",
        "Si alguien se queja de un corte, pedí disculpas y derivá a una persona de inmediato.",
        "Por Instagram, pedí nombre y teléfono antes de confirmar un turno.",
      ],
      afterHoursNote:
        "Fuera de horario igual podés agendar, pero aclarás que el local atiende de martes a sábado de 11 a 20.",
    },
  }
}
