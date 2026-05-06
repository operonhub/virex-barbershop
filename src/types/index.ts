export interface Turno {
  id: string
  clienteNombre: string
  clienteTelefono: string
  servicio: string
  fecha: string
  hora: string
  precio: number
  estado: 'confirmado' | 'pendiente' | 'cancelado'
}

export interface Pago {
  id: string
  clienteNombre: string
  servicio: string
  monto: number
  metodo: 'efectivo' | 'transferencia' | 'debito'
  fecha: string
  estado: 'pagado' | 'pendiente'
}

export interface Mensaje {
  id: string
  texto: string
  timestamp: string
  fromClient: boolean
}

export interface Conversacion {
  id: string
  clienteNombre: string
  plataforma: 'whatsapp' | 'instagram' | 'tiktok'
  ultimoMensaje: string
  timestamp: string
  noLeidos: number
  mensajes: Mensaje[]
}

export interface AgenteConfig {
  nombre: string
  tono: 'formal' | 'amigable' | 'casual'
  servicios: string[]
  horario: string
  politicaCancelacion: string
  redes: {
    whatsapp: boolean
    instagram: boolean
    tiktok: boolean
  }
  configurado: boolean
}

export const SERVICIOS_PRECIOS: Record<string, number> = {
  'Corte clásico': 400,
  'Corte + barba': 650,
  'Barba completa': 300,
  'Degradé': 500,
  'Corte + degradé': 550,
  'Diseño de barba': 400,
  'Cejas': 100,
}
