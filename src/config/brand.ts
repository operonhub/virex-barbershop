/**
 * Datos del negocio. Todo lo que dice "Virex" en la app sale de acá.
 *
 * Fuente: bio de @virex_barbershop (2026-09-17) y datos que pasó Santiago
 * (cliente del local hace 10 años) el 2026-09-24: horario, barberos, precios y
 * turnos de una hora. Las comisiones siguen siendo un supuesto.
 *
 * Mantenerlo en un solo archivo es deliberado: si mañana esta app se
 * reutiliza para otra barbería, el cambio de marca empieza por acá (más los
 * tokens de `globals.css`), no por buscar strings en cien componentes.
 */
export const BRAND = {
  name: "Virex",
  fullName: "Virex Barber Shop",
  tagline: "Donde tu imagen sube de nivel",
  claim: "Pensada para los que saben lo que valen",
  address: "Oncativo 2022, Lanús Este",
  city: "Lanús Este, Buenos Aires",
  timezone: "America/Argentina/Buenos_Aires",
  currency: "ARS",
  instagram: "virex_barbershop",
  whatsappLink: "https://wa.me/message/J7VPW5MTR7CMA1",
  /** 0 = domingo … 6 = sábado. Bio: "Mar–Sáb 11:00 a 20:00". */
  openingHours: {
    days: [2, 3, 4, 5, 6],
    open: "11:00",
    close: "20:00",
  },
  /**
   * Los turnos duran una hora: el agente y la reserva web ofrecen horarios
   * en punto. Desde el panel se puede cargar a cualquier hora (walk-in).
   */
  booking: {
    slotStepMin: 60,
  },
  /** Tarjeta de fidelidad física que ya usan: 5 cortes sellados → el 6to al 50%. */
  loyalty: {
    stampsRequired: 5,
    rewardDiscountPct: 50,
  },
} as const

export type Brand = typeof BRAND
