/**
 * Datos del negocio. Todo lo que dice "Virex" en la app sale de acá.
 *
 * Fuente: bio de @virex_barbershop (relevada el 2026-09-17). Lo marcado
 * `aConfirmar` salió de supuestos razonables y se valida con el cliente.
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
  /** Tarjeta de fidelidad física que ya usan: 5 cortes sellados → el 6to al 50%. */
  loyalty: {
    stampsRequired: 5,
    rewardDiscountPct: 50,
  },
} as const

export type Brand = typeof BRAND
