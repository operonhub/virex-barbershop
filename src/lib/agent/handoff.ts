import type { Channel } from "@/lib/domain/types"

/**
 * Red de seguridad ANTES de llamar al modelo.
 *
 * El agente ya sabe derivar solo (tiene la herramienta `derivar_a_humano` y
 * el prompt se lo pide ante quejas o dudas). Esta función existe para lo que
 * el dueño quiere GARANTIZADO, sin depender del criterio del modelo: si
 * devuelve `handOff: true`, la IA ni se entera del mensaje — la conversación
 * pasa directo a una persona y se marca en rojo en la Bandeja.
 *
 * Se evalúa en cada mensaje entrante de una conversación en modo IA.
 */

export interface HandoffContext {
  /** Último mensaje del cliente, tal cual llegó. */
  text: string
  channel: Channel
  /** Cuántas respuestas seguidas dio la IA en esta conversación sin agendar nada. */
  agentRepliesWithoutBooking: number
  /** ¿Ya es cliente (tiene ficha)? */
  isKnownClient: boolean
  /** Hora local (0–23) en Argentina. */
  hour: number
}

export type HandoffDecision = { handOff: false } | { handOff: true; reason: string }

export function shouldHandOff(ctx: HandoffContext): HandoffDecision {
  // TODO(Santiago): definir la política con el dueño de Virex el domingo.
  //
  // Lo que hay que decidir (5–10 líneas):
  //  - ¿Qué palabras disparan derivación sí o sí? (reclamo, "desparejo",
  //    "quiero hablar con alguien", "me cobraron mal"…). Ojo con los falsos
  //    positivos: "¿hacen degradé desparejo a propósito?" no es un reclamo.
  //  - ¿Cortamos si la IA ya respondió N veces sin lograr agendar? (señal de
  //    que no entiende lo que el cliente quiere y lo está frustrando).
  //  - ¿Tratamos distinto a un desconocido de Instagram que a un cliente fiel?
  //  - Fuera de horario, derivar no sirve de mucho (nadie va a contestar):
  //    ¿conviene que la IA siga igual y deje la nota para mañana?
  //
  // Devolvé { handOff: true, reason: "texto corto para el equipo" } o { handOff: false }.
  void ctx
  return { handOff: false }
}
