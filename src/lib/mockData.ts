import { today, addDays } from './utils'
import type { Turno, Pago, Conversacion, AgenteConfig } from '@/types'

const t = today()

export const MOCK_TURNOS: Turno[] = [
  { id: 't1', clienteNombre: 'Matías Rodríguez', clienteTelefono: '+598912345671', servicio: 'Corte + barba', fecha: t, hora: '09:00', precio: 650, estado: 'confirmado' },
  { id: 't2', clienteNombre: 'Lucas García', clienteTelefono: '+598912345672', servicio: 'Corte clásico', fecha: t, hora: '10:00', precio: 400, estado: 'confirmado' },
  { id: 't3', clienteNombre: 'Javier Méndez', clienteTelefono: '+598912345673', servicio: 'Barba completa', fecha: t, hora: '12:00', precio: 300, estado: 'pendiente' },
  { id: 't4', clienteNombre: 'Diego Torres', clienteTelefono: '+598912345674', servicio: 'Degradé', fecha: t, hora: '14:00', precio: 500, estado: 'confirmado' },
  { id: 't5', clienteNombre: 'Facundo López', clienteTelefono: '+598912345675', servicio: 'Corte + barba', fecha: t, hora: '15:00', precio: 650, estado: 'confirmado' },
  { id: 't6', clienteNombre: 'Ramiro Suárez', clienteTelefono: '+598912345676', servicio: 'Corte clásico', fecha: t, hora: '16:30', precio: 400, estado: 'pendiente' },
  { id: 't7', clienteNombre: 'Nicolás Vega', clienteTelefono: '+598912345677', servicio: 'Corte + degradé', fecha: t, hora: '17:30', precio: 550, estado: 'confirmado' },
  { id: 't8', clienteNombre: 'Sebastián Ruiz', clienteTelefono: '+598912345678', servicio: 'Diseño de barba', fecha: t, hora: '18:30', precio: 400, estado: 'cancelado' },
  { id: 't9', clienteNombre: 'Andrés Flores', clienteTelefono: '+598912345679', servicio: 'Degradé', fecha: addDays(t, 1), hora: '10:00', precio: 500, estado: 'confirmado' },
  { id: 't10', clienteNombre: 'Tomás Ríos', clienteTelefono: '+598912345680', servicio: 'Barba completa', fecha: addDays(t, 1), hora: '11:30', precio: 300, estado: 'pendiente' },
  { id: 't11', clienteNombre: 'Pablo Ortiz', clienteTelefono: '+598912345681', servicio: 'Corte clásico', fecha: addDays(t, -1), hora: '09:30', precio: 400, estado: 'confirmado' },
  { id: 't12', clienteNombre: 'Fernando Castro', clienteTelefono: '+598912345682', servicio: 'Corte + barba', fecha: addDays(t, -1), hora: '11:00', precio: 650, estado: 'confirmado' },
  { id: 't13', clienteNombre: 'Gustavo Rojas', clienteTelefono: '+598912345683', servicio: 'Degradé', fecha: addDays(t, -2), hora: '10:00', precio: 500, estado: 'confirmado' },
  { id: 't14', clienteNombre: 'Hernán Molina', clienteTelefono: '+598912345684', servicio: 'Corte + barba', fecha: addDays(t, -2), hora: '14:00', precio: 650, estado: 'confirmado' },
  { id: 't15', clienteNombre: 'Carlos Sosa', clienteTelefono: '+598912345685', servicio: 'Corte clásico', fecha: addDays(t, -3), hora: '09:00', precio: 400, estado: 'confirmado' },
]

export const MOCK_PAGOS: Pago[] = [
  { id: 'p1', clienteNombre: 'Matías Rodríguez', servicio: 'Corte + barba', monto: 650, metodo: 'efectivo', fecha: t, estado: 'pagado' },
  { id: 'p2', clienteNombre: 'Lucas García', servicio: 'Corte clásico', monto: 400, metodo: 'transferencia', fecha: t, estado: 'pagado' },
  { id: 'p3', clienteNombre: 'Diego Torres', servicio: 'Degradé', monto: 500, metodo: 'debito', fecha: t, estado: 'pagado' },
  { id: 'p4', clienteNombre: 'Facundo López', servicio: 'Corte + barba', monto: 650, metodo: 'efectivo', fecha: t, estado: 'pagado' },
  { id: 'p5', clienteNombre: 'Pablo Ortiz', servicio: 'Corte clásico', monto: 400, metodo: 'efectivo', fecha: addDays(t, -1), estado: 'pagado' },
  { id: 'p6', clienteNombre: 'Fernando Castro', servicio: 'Corte + barba', monto: 650, metodo: 'transferencia', fecha: addDays(t, -1), estado: 'pagado' },
  { id: 'p7', clienteNombre: 'Gustavo Rojas', servicio: 'Degradé', monto: 500, metodo: 'debito', fecha: addDays(t, -2), estado: 'pagado' },
  { id: 'p8', clienteNombre: 'Hernán Molina', servicio: 'Corte + barba', monto: 650, metodo: 'efectivo', fecha: addDays(t, -2), estado: 'pagado' },
  { id: 'p9', clienteNombre: 'Carlos Sosa', servicio: 'Corte clásico', monto: 400, metodo: 'efectivo', fecha: addDays(t, -3), estado: 'pagado' },
  { id: 'p10', clienteNombre: 'Ramiro Suárez', servicio: 'Barba completa', monto: 300, metodo: 'transferencia', fecha: addDays(t, -3), estado: 'pagado' },
  { id: 'p11', clienteNombre: 'Javier Méndez', servicio: 'Barba completa', monto: 300, metodo: 'efectivo', fecha: addDays(t, -4), estado: 'pagado' },
  { id: 'p12', clienteNombre: 'Nicolás Vega', servicio: 'Corte + degradé', monto: 3500, metodo: 'debito', fecha: addDays(t, -4), estado: 'pagado' },
]

export const MOCK_CONVERSACIONES: Conversacion[] = [
  {
    id: 'c1',
    clienteNombre: 'Matías Rodríguez',
    plataforma: 'whatsapp',
    ultimoMensaje: 'Claro! Te tengo el jueves a las 10. ¿Lo confirmamos?',
    timestamp: '10:43',
    noLeidos: 2,
    mensajes: [
      { id: 'm1', texto: 'Hola! Buen día', timestamp: '10:30', fromClient: true },
      { id: 'm2', texto: 'Buen día Matías! ¿Cómo andás?', timestamp: '10:31', fromClient: false },
      { id: 'm3', texto: '¿Tenés lugar el jueves a las 10?', timestamp: '10:42', fromClient: true },
      { id: 'm3r', texto: 'Claro! Te tengo el jueves a las 10. ¿Lo confirmamos?', timestamp: '10:43', fromClient: false },
    ],
  },
  {
    id: 'c2',
    clienteNombre: 'Lucas García',
    plataforma: 'instagram',
    ultimoMensaje: 'Genial! Cualquier cosa avisame. ¡Hasta mañana!',
    timestamp: '09:16',
    noLeidos: 0,
    mensajes: [
      { id: 'm4', texto: 'Hola! Vi tus fotos en el perfil, quedaron geniales los cortes', timestamp: '09:00', fromClient: true },
      { id: 'm5', texto: 'Gracias! ¿Querés sacar turno?', timestamp: '09:05', fromClient: false },
      { id: 'm6', texto: 'Sí, para mañana a las 10', timestamp: '09:10', fromClient: true },
      { id: 'm7', texto: 'Dale! Te espero mañana a las 10 entonces', timestamp: '09:12', fromClient: false },
      { id: 'm8', texto: 'Perfecto! Ahí estaré', timestamp: '09:15', fromClient: true },
      { id: 'm8r', texto: 'Genial! Cualquier cosa avisame. ¡Hasta mañana!', timestamp: '09:16', fromClient: false },
    ],
  },
  {
    id: 'c3',
    clienteNombre: 'Javier Méndez',
    plataforma: 'tiktok',
    ultimoMensaje: 'El corte + barba está en $650. ¿Querés que te reserve un turno?',
    timestamp: 'Ayer',
    noLeidos: 1,
    mensajes: [
      { id: 'm9', texto: 'Ví tu video! Re buen corte el que hiciste', timestamp: 'Ayer 18:00', fromClient: true },
      { id: 'm10', texto: 'Gracias! ¿Te gustaría uno similar?', timestamp: 'Ayer 18:30', fromClient: false },
      { id: 'm11', texto: 'Qué precio tiene el corte + barba?', timestamp: 'Ayer 19:00', fromClient: true },
      { id: 'm11r', texto: 'El corte + barba está en $650. ¿Querés que te reserve un turno?', timestamp: 'Ayer 19:01', fromClient: false },
    ],
  },
  {
    id: 'c4',
    clienteNombre: 'Diego Torres',
    plataforma: 'whatsapp',
    ultimoMensaje: '¡Hasta pronto Diego! Fue un placer atenderte 💈',
    timestamp: 'Ayer',
    noLeidos: 0,
    mensajes: [
      { id: 'm12', texto: 'Hola! ¿A qué hora abrís hoy?', timestamp: 'Ayer 08:00', fromClient: true },
      { id: 'm13', texto: '¡Hola Diego! Abrimos a las 9. ¿Venís?', timestamp: 'Ayer 08:05', fromClient: false },
      { id: 'm14', texto: 'Sí, ahí voy a las 14', timestamp: 'Ayer 08:10', fromClient: true },
      { id: 'm14r', texto: 'Perfecto, te anotamos a las 14. ¡Te esperamos!', timestamp: 'Ayer 08:11', fromClient: false },
      { id: 'm15', texto: 'Gracias, hasta luego!', timestamp: 'Ayer 14:45', fromClient: true },
      { id: 'm15r', texto: '¡Hasta pronto Diego! Fue un placer atenderte 💈', timestamp: 'Ayer 14:46', fromClient: false },
    ],
  },
  {
    id: 'c5',
    clienteNombre: 'Facundo López',
    plataforma: 'instagram',
    ultimoMensaje: '¡Hola Facundo! Claro, tengo lugar el sábado. ¿A qué hora preferís?',
    timestamp: 'Lun',
    noLeidos: 3,
    mensajes: [
      { id: 'm16', texto: 'Buenas! Me podés reservar para el sábado?', timestamp: 'Lun 15:00', fromClient: true },
      { id: 'm16r', texto: '¡Hola Facundo! Claro, tengo lugar el sábado. ¿A qué hora preferís?', timestamp: 'Lun 15:01', fromClient: false },
    ],
  },
  {
    id: 'c6',
    clienteNombre: 'Nicolás Vega',
    plataforma: 'whatsapp',
    ultimoMensaje: 'Confirmado Nicolás! Ahí te espero',
    timestamp: 'Lun',
    noLeidos: 0,
    mensajes: [
      { id: 'm17', texto: 'Confirmo el turno de las 5:30', timestamp: 'Lun 09:00', fromClient: true },
      { id: 'm18', texto: 'Confirmado Nicolás! Ahí te espero', timestamp: 'Lun 09:10', fromClient: false },
    ],
  },
]

export const MOCK_AGENTE: AgenteConfig = {
  nombre: 'BarberBot',
  tono: 'amigable',
  servicios: ['Corte clásico', 'Corte + barba', 'Barba completa', 'Degradé'],
  horario: 'Lunes a Sábado de 9:00 a 20:00',
  politicaCancelacion: 'Cancelar con al menos 2 horas de anticipación',
  redes: {
    whatsapp: true,
    instagram: false,
    tiktok: false,
  },
  configurado: false,
}
