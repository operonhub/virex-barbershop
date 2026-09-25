import "server-only"
import { db, now } from "./repo"
import { addDays, addMonths, dayKey, daysInMonth, monthKey } from "@/lib/time"
import { isOpen, occupancy } from "@/lib/domain/slots"
import { loyaltyStatus } from "@/lib/domain/loyalty"
import {
  dailySeries,
  expensesByCategory,
  expensesInMonth,
  noShowRate,
  paymentsInMonth,
  paymentsOnDay,
  serviceBreakdown,
  sourceBreakdown,
  staffBreakdown,
  summarizePayments,
} from "@/lib/domain/finance"
import type { Appointment, Client } from "@/lib/domain/types"

/**
 * Consultas por pantalla. Cada una arma exactamente lo que su página
 * necesita, así los componentes no filtran listas enteras en el navegador.
 */

const ACTIVE = (a: Appointment) => a.status !== "cancelado" && a.status !== "no_show"

export async function getShell() {
  const s = await db()
  const n = await now()
  return {
    now: n.toISOString(),
    simulated: s.simulated,
    unread: s.conversations.reduce((sum, c) => sum + c.unread, 0),
    needsHuman: s.conversations.filter((c) => c.needsHuman).length,
    agentEnabled: s.agentSettings.enabled,
  }
}

export async function getCatalog() {
  const s = await db()
  return { staff: s.staff, services: s.services, clients: s.clients }
}

/* ── Hoy ── */

export async function getHoy() {
  const s = await db()
  const n = await now()
  const today = dayKey(n)

  const appts = s.appointments.filter((a) => dayKey(a.startsAt) === today)
  const active = appts.filter(ACTIVE)
  const paid = paymentsOnDay(s.payments, today)
  const money = summarizePayments(paid)
  const paidIds = new Set(paid.map((p) => p.appointmentId))

  const upcoming = active
    .filter((a) => new Date(a.startsAt) > n)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))

  const toCharge = active.filter(
    (a) => (a.status === "en_curso" || a.status === "completado") && !paidIds.has(a.id)
  )

  // Clientes que vienen hoy y tienen la tarjeta completa: que nadie se olvide
  // de aplicarles el 50 %.
  const rewardsToday = upcoming
    .map((a) => ({
      appointment: a,
      loyalty: loyaltyStatus(a.clientId, s.payments, s.services),
      service: s.services.find((sv) => sv.id === a.serviceId)!,
    }))
    .filter((x) => x.loyalty.rewardReady && x.service.countsForLoyalty)

  const agentMsgsToday = s.messages.filter((m) => m.author === "ia" && dayKey(m.sentAt) === today)
  const agentBookedToday = s.appointments.filter(
    (a) => a.source === "agente" && dayKey(a.createdAt) === today
  ).length

  return {
    now: n.toISOString(),
    today,
    open: isOpen(today),
    staff: s.staff,
    services: s.services,
    clients: s.clients,
    appointments: appts,
    money,
    expected: active.reduce((sum, a) => sum + a.price, 0),
    doneCount: active.filter((a) => a.status === "completado").length,
    activeCount: active.length,
    occupancy: occupancy(appts, s.staff.length, [today]),
    next: upcoming[0] ?? null,
    toCharge,
    rewardsToday,
    recontact: atRiskClients(s.clients, s.appointments, n).slice(0, 4),
    inbox: {
      unread: s.conversations.reduce((sum, c) => sum + c.unread, 0),
      needsHuman: s.conversations.filter((c) => c.needsHuman),
    },
    agent: {
      enabled: s.agentSettings.enabled,
      conversations: new Set(agentMsgsToday.map((m) => m.conversationId)).size,
      booked: agentBookedToday,
      events: s.agentEvents.filter((e) => dayKey(e.at) === today).slice(0, 6),
    },
  }
}

/**
 * Clientes habituales que dejaron de venir: 3+ visitas, la última hace más de
 * 35 días y sin turno futuro. Es la lista para mandarles un "¿te buscamos
 * turno?" — el agente lo puede hacer solo más adelante.
 */
function atRiskClients(clients: Client[], appointments: Appointment[], n: Date) {
  const out: { client: Client; lastVisit: string; visits: number }[] = []
  for (const client of clients) {
    const mine = appointments.filter((a) => a.clientId === client.id)
    const done = mine.filter((a) => a.status === "completado")
    if (done.length < 3) continue
    if (mine.some((a) => ACTIVE(a) && new Date(a.startsAt) > n)) continue
    const last = done[done.length - 1].startsAt
    const days = (n.getTime() - new Date(last).getTime()) / 86_400_000
    if (days > 35) out.push({ client, lastVisit: last, visits: done.length })
  }
  return out.sort((a, b) => b.visits - a.visits)
}

/* ── Agenda ── */

export async function getAgenda(day: string) {
  const s = await db()
  const n = await now()
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - ((new Date(`${day}T12:00:00-03:00`).getUTCDay() + 6) % 7)))
  return {
    now: n.toISOString(),
    today: dayKey(n),
    day,
    open: isOpen(day),
    staff: s.staff,
    services: s.services,
    clients: s.clients,
    appointments: s.appointments.filter((a) => dayKey(a.startsAt) === day),
    paidAppointmentIds: s.payments.filter((p) => p.appointmentId).map((p) => p.appointmentId!),
    loyalty: Object.fromEntries(
      [...new Set(s.appointments.filter((a) => dayKey(a.startsAt) === day).map((a) => a.clientId))].map((id) => [
        id,
        loyaltyStatus(id, s.payments, s.services),
      ])
    ),
    week: week.map((d) => {
      const appts = s.appointments.filter((a) => dayKey(a.startsAt) === d)
      return {
        day: d,
        open: isOpen(d),
        count: appts.filter(ACTIVE).length,
        occupancy: occupancy(appts, s.staff.length, [d]),
      }
    }),
  }
}

/* ── Bandeja ── */

export async function getBandeja() {
  const s = await db()
  const n = await now()
  return {
    now: n.toISOString(),
    conversations: s.conversations,
    messages: s.messages,
    clients: s.clients,
    staff: s.staff,
    services: s.services,
    agentName: s.agentSettings.name,
    appointments: s.appointments.filter((a) => new Date(a.startsAt) > new Date(n.getTime() - 86_400_000 * 45)),
    loyalty: Object.fromEntries(
      s.conversations
        .filter((c) => c.clientId)
        .map((c) => [c.clientId!, loyaltyStatus(c.clientId!, s.payments, s.services)])
    ),
  }
}

/* ── Clientes ── */

export async function getClientes() {
  const s = await db()
  const n = await now()
  const rows = s.clients.map((client) => {
    const mine = s.appointments.filter((a) => a.clientId === client.id)
    const done = mine.filter((a) => a.status === "completado")
    const spent = s.payments.filter((p) => p.clientId === client.id).reduce((sum, p) => sum + p.amount, 0)
    const next = mine
      .filter((a) => ACTIVE(a) && new Date(a.startsAt) > n)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    const last = done[done.length - 1]
    const daysSince = last ? Math.floor((n.getTime() - new Date(last.startsAt).getTime()) / 86_400_000) : null
    const segment: "nuevo" | "frecuente" | "en_riesgo" | "ocasional" =
      done.length <= 1
        ? "nuevo"
        : !next && daysSince !== null && daysSince > 35 && done.length >= 3
          ? "en_riesgo"
          : done.length >= 5
            ? "frecuente"
            : "ocasional"
    return {
      client,
      visits: done.length,
      noShows: mine.filter((a) => a.status === "no_show").length,
      spent,
      avgTicket: done.length ? Math.round(spent / done.length) : 0,
      lastVisit: last?.startsAt ?? null,
      next: next ?? null,
      daysSince,
      segment,
      loyalty: loyaltyStatus(client.id, s.payments, s.services),
      history: done.slice(-8).reverse(),
    }
  })
  rows.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""))
  return { now: n.toISOString(), rows, staff: s.staff, services: s.services }
}

/* ── Caja ── */

export async function getCaja(day: string) {
  const s = await db()
  const n = await now()
  const payments = paymentsOnDay(s.payments, day).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  const expenses = s.expenses.filter((e) => dayKey(e.paidAt) === day)
  const paidIds = new Set(s.payments.map((p) => p.appointmentId))
  const pending = s.appointments.filter(
    (a) =>
      dayKey(a.startsAt) === day &&
      (a.status === "en_curso" || a.status === "completado" || (a.status === "confirmado" && new Date(a.startsAt) < n)) &&
      !paidIds.has(a.id)
  )
  return {
    now: n.toISOString(),
    day,
    isToday: day === dayKey(n),
    payments,
    expenses,
    money: summarizePayments(payments),
    staffLines: staffBreakdown(payments, s.staff),
    // Un día ya cerrado conserva el fondo con el que se cerró.
    openingCash: s.cashClosures.find((c) => c.day === day)?.openingCash ?? s.shopSettings.openingCash,
    closure: s.cashClosures.find((c) => c.day === day) ?? null,
    pending,
    staff: s.staff,
    services: s.services,
    clients: s.clients,
    loyalty: Object.fromEntries(
      pending.map((a) => [a.clientId, loyaltyStatus(a.clientId, s.payments, s.services)])
    ),
  }
}

/* ── Finanzas ── */

export async function getFinanzas(month: string) {
  const s = await db()
  const n = await now()
  const today = dayKey(n)
  const prev = addMonths(month, -1)

  const pay = paymentsInMonth(s.payments, month)
  const payPrev = paymentsInMonth(s.payments, prev)
  const exp = expensesInMonth(s.expenses, month)
  const expPrev = expensesInMonth(s.expenses, prev)
  const appts = s.appointments.filter((a) => monthKey(dayKey(a.startsAt)) === month && new Date(a.startsAt) <= n)
  const apptsPrev = s.appointments.filter((a) => monthKey(dayKey(a.startsAt)) === prev)

  const days = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)
  const prevDays = Array.from({ length: daysInMonth(prev) }, (_, i) => `${prev}-${String(i + 1).padStart(2, "0")}`)
  const elapsed = days.filter((d) => d <= today)

  // Comparar contra el mismo tramo del mes anterior, no contra el mes entero:
  // si no, el día 17 siempre parece que se vende la mitad.
  const cut = elapsed.length
  const prevSameSpan = payPrev.filter((p) => Number(dayKey(p.paidAt).slice(8)) <= cut)

  const money = summarizePayments(pay)
  const moneyPrevSpan = summarizePayments(prevSameSpan)
  const expTotal = exp.reduce((sum, e) => sum + e.amount, 0)

  return {
    now: n.toISOString(),
    month,
    isCurrent: month === monthKey(today),
    money,
    moneyPrev: summarizePayments(payPrev),
    moneyPrevSpan,
    expenses: exp.sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    expensesTotal: expTotal,
    expensesPrevTotal: expPrev.reduce((sum, e) => sum + e.amount, 0),
    expensesByCategory: expensesByCategory(exp),
    net: money.gross - expTotal,
    daily: dailySeries(pay, days).map((d, i) => ({
      ...d,
      prev: dailySeries(payPrev, prevDays)[i]?.total ?? 0,
      future: d.day > today,
    })),
    staffLines: staffBreakdown(pay, s.staff),
    serviceLines: serviceBreakdown(pay, s.services),
    sources: sourceBreakdown(pay, appts),
    completed: appts.filter((a) => a.status === "completado").length,
    completedPrev: apptsPrev.filter((a) => a.status === "completado").length,
    noShow: noShowRate(appts),
    occupancy: occupancy(appts, s.staff.length, elapsed),
    occupancyPrev: occupancy(apptsPrev, s.staff.length, prevDays),
    loyaltyRedeemed: pay.filter((p) => p.discountReason === "fidelidad").length,
  }
}

/* ── Agente ── */

export async function getAgente() {
  const s = await db()
  const n = await now()
  const month = monthKey(dayKey(n))
  const agentAppts = s.appointments.filter(
    (a) => a.source === "agente" && monthKey(dayKey(a.createdAt)) === month
  )
  const agentPaid = s.payments.filter((p) => agentAppts.some((a) => a.id === p.appointmentId))
  return {
    now: n.toISOString(),
    settings: s.agentSettings,
    services: s.services,
    staff: s.staff,
    events: s.agentEvents.slice(0, 12),
    stats: {
      bookedMonth: agentAppts.length,
      revenueMonth: agentPaid.reduce((sum, p) => sum + p.amount, 0),
      handoffs: s.conversations.filter((c) => c.handoffReason).length,
      conversations: s.conversations.length,
    },
  }
}
