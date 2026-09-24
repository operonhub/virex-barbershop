# Virex · Plan

> Escrito el 2026-09-18, antes de la reunión con el cliente del domingo 20/09.

## La idea en una línea

Que el dueño de Virex no tenga que agarrar el celular para agendar: el agente responde
WhatsApp e Instagram y llena la agenda solo; el panel muestra el día, la plata y a quién
hay que llamar.

## Qué está hecho (esqueleto funcional, modo demo)

| Módulo | Qué hace hoy |
|---|---|
| **Hoy** | Caja del día, ocupación, "La jornada" (un carril por barbero con la línea del ahora), próximos turnos, a quién le toca el 50 %, clientes a recontactar, agente en vivo |
| **Agenda** | Día por barbero, semana con ocupación, tocar un hueco agenda ahí, ficha del turno con confirmar → empezar → cobrar |
| **Bandeja** | WhatsApp + Instagram juntos, "Responde la IA / Respondo yo" por chat, derivaciones en rojo, ventana de 24 h de WhatsApp, respuestas rápidas, ficha del cliente al costado |
| **Clientes** | 440 clientes demo, segmentos (frecuente / en riesgo / nuevo), notas de corte, historial, tarjeta de fidelidad digital |
| **Caja** | Lo que entró por medio de pago, efectivo esperado, por cobrar, liquidación por barbero (comisión + propinas), gastos, cierre de caja |
| **Finanzas** | Mes vs mes anterior (mismo tramo), por barbero, servicio, medio de pago, día de la semana, **cuánto facturó lo que agendó el agente**, gastos |
| **Agente IA** | Activar/pausar, tono, canales, permisos, reglas del dueño, **chat de prueba con el agente real** (agenda de verdad) |
| **Reservar** | Página pública mobile-first: servicio → horario → datos → confirmado |
| **Backend** | Webhook de Zernio, loop del agente con Claude + 7 herramientas, esquema de Supabase con RLS |

Todo verificado: `tsc`, ESLint (React Compiler), 8 tests de dominio, migración en Postgres
real y recorrido end-to-end con Playwright (reserva pública, nuevo turno, cobro).

## Identidad

Sale del logo real (negro #080808 + oro metálico, medido sobre la foto de perfil) y del local
(paredes de listones negros, líneas de LED en el techo).

- **Paleta:** obsidiana `#0B0A09`, marfil `#F2EDE3`, oro `#D6B36A` (sólo acción principal,
  el "ahora" y la fidelidad). Contrastes AA verificados. Gráficos con paleta propia validada
  para daltonismo (`#B48931` / `#4585BF`).
- **Tipografía:** una sola familia, Archivo, jugando con el eje de ancho: títulos al 125 %
  (la sans extendida del logo), cuerpo al 100 %.
- **Isotipo:** doble anillo + V + el ala de debajo de BARBERSHOP + destello ✦.
- **Intro (~1,4 s, una vez por sesión, se saltea con un toque):** se prenden las líneas de LED
  del techo, se dibuja el anillo, aparece la V, destella el ✦ y la marca vuela al sidebar.
- **Textura:** las listas verticales de la pared, apenas visibles, en el sidebar.

## Arquitectura

```
WhatsApp / Instagram
        │
     Zernio ──webhook firmado──▶ /api/zernio/webhook ──▶ base (mensaje)
        ▲                               │ after()
        │                               ▼
        └──── sendMessage ◀──── agente (Claude + herramientas) ──▶ agenda
                                         │
                          consultar_disponibilidad · crear_turno · turnos_del_cliente
                          reprogramar_turno · cancelar_turno · consultar_fidelidad
                          derivar_a_humano
```

- **Nada de doble turno:** la app sugiere horarios (`lib/domain/slots.ts`, la misma función
  para agente, panel y reserva web) y la base lo garantiza con una restricción `EXCLUDE`.
- **El modelo propone, el código decide:** cada herramienta revalida permisos, horario libre
  y que el turno sea del cliente que escribe.
- **Si la IA no puede, se entera una persona:** cualquier falla del agente marca el chat en
  rojo en la Bandeja; nunca queda un cliente sin respuesta y sin nadie avisado.
- **Modelo:** Claude Opus 5 por defecto, con fallback del lado del servidor. Configurable con
  `AGENT_MODEL`. Prompt dividido en parte fija (cacheable) y contexto volátil al final.

## Fases hasta producción

Reemplazado por **[`ROADMAP.md`](ROADMAP.md)** (23/09): orden por día hasta la entrega del
02/10, deploy en Railway, agente multi-proveedor, seña con Mercado Pago y recordatorios.

## Preguntas para el domingo

**Agenda**
- [ ] ¿Cuántos barberos y sillas? Nombres, días y horarios de cada uno.
- [ ] Servicios, precios y duración real de cada uno. ¿Quién hace color/platinado?
- [ ] ¿Aceptan sin turno? ¿Dejan huecos para eso?
- [ ] ¿Cuánto antes se puede cancelar? ¿Qué pasa con los que no vienen?

**Agente**
- [ ] ¿Lo querés agendando solo desde el día 1, o primero sólo respondiendo?
- [ ] ¿Qué NO tiene que hacer nunca? (reglas del dueño)
- [ ] ¿Cuándo querés que te pase la conversación? (define `shouldHandOff`)
- [ ] ¿Qué tono? (cercano / profesional / canchero — están los ejemplos en la pantalla)

**Plata**
- [ ] ¿Cómo se reparte con los barberos? (% de comisión, propinas, alquiler de silla)
- [ ] ¿Los barberos ven la caja y las finanzas, o sólo el dueño?
- [ ] ¿Cobran seña para reservar? ¿Usan Mercado Pago, posnet, ambos?
- [ ] ¿Venden productos? ¿Querés llevar stock?
- [ ] Fondo fijo de caja al abrir.

**Fidelidad**
- [ ] ¿Qué servicios suman sello? (hoy: todo lo que incluye corte)
- [ ] ¿El 50 % aplica sólo al corte o al servicio completo?
- [ ] ¿Pasamos las tarjetas de cartón actuales al sistema? (carga inicial de sellos)

**Canales**
- [ ] ¿El WhatsApp del local es Business? ¿Quién lo tiene en el celular?
- [ ] ¿Usan otro sistema de turnos hoy? ¿Hay que migrar clientes?

## Costo del agente (estimación gruesa, a medir)

Una conversación de reserva típica: 3–4 turnos, ~15 k tokens de entrada (la mayor parte, el
prompt fijo y las herramientas) y 1–4 k de salida (Opus 5 razona por defecto y ese
razonamiento se cobra como salida). Con Opus 5 ($5 / $25 por millón) da del orden de
**USD 0,05–0,15 por conversación**; con 300 conversaciones al mes, unos USD 15–45. Sonnet 5
($2 / $10) lo baja a menos de la mitad.

Dos incógnitas que sólo se resuelven midiendo: si el prefijo fijo supera el mínimo
cacheable del modelo (si no, el caché no aplica y la entrada cuesta un poco más) y cuánto
razona en conversaciones reales. El número verdadero sale de `agent_runs` en las primeras
semanas, y con eso se decide modelo y `AGENT_EFFORT`.
