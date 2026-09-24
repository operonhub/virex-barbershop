# Virex · Roadmap a entrega (demo → producción)

> Escrito el 2026-09-23. Entrega objetivo: viernes 02/10. Se tacha a medida que avanza.

## Contexto

El panel está hecho y al cliente le encantó (reunión del 20/09), pero **todo corre sobre datos
en memoria** (`src/lib/data/repo.ts` + `seed.ts`). Hay que entregarlo **la semana que viene**.
Supuesto: entrega el **viernes 02/10**, con el lunes 28 al jueves 01 de trabajo pleno.

Decisiones ya tomadas:
- **Todo en Railway, un solo servicio:** panel, webhook, agente y tareas programadas. n8n queda
  descartado: la automatización vive en el código, con tests.
- **Entra además del núcleo:** recordatorios por WhatsApp y seña con Mercado Pago.
- **Quedan afuera:** roles barbero/dueño (todos ven todo) y productos/stock.
- **Faltan datos del cliente:** el plan separa lo que bloquea de lo que no.

El orden sale de dos reglas: **primero lo que depende de terceros** (Meta tarda en aprobar,
el dueño tiene que estar presente para conectar WhatsApp) y **primero lo que nunca se probó**
(el agente jamás corrió contra la API real).

---

## Fase 0 · Hoy/mañana: destrabar dependencias externas (sin código)

Todo esto tarda días por razones ajenas, así que arranca ya y en paralelo:

| # | Qué | Quién | Por qué ahora |
|---|---|---|---|
| 0.1 | Mandarle al cliente la **lista de datos faltantes** (abajo) con fecha límite el **lunes 28** | Santiago | Todo lo demás se puede construir con supuestos, pero la carga final no |
| 0.2 | Agendar **sesión con el dueño** (celular en mano) para conectar WhatsApp (Coexistence) + Instagram en Zernio | Santiago | Sin él no hay canales, y sin canales no hay plantilla |
| 0.3 | Crear proyecto **Supabase en `us-east-1`** y proyecto **Railway en US East** | Santiago | Base y servidor en la misma región. Si la base queda en São Paulo, cada consulta suma ~120 ms |
| 0.4 | Clave de **Gemini** (Google AI Studio, con facturación activada) y de **Anthropic**, las dos con límite de gasto | Santiago | Para comparar los modelos el jueves |
| 0.5 | Acceso a la **cuenta de Mercado Pago del local**: credenciales de producción de una app en MP Developers | Dueño | Sin eso no hay seña |

**Datos a pedir** (en negrita, lo que bloquea la entrega):
- **Barberos**, días y horarios de cada uno, qué servicios no hace cada uno.
- **Servicios, precios y duraciones**, y comisión de cada barbero.
- **Seña:** monto (fijo o %), si aplica a todos los turnos o sólo a algunos, qué pasa si
  cancelan (¿se devuelve?, ¿con cuánta anticipación?).
- **Emails del equipo** para crear los accesos.
- Autonomía del agente: ¿agenda solo desde el día 1 o arranca sólo respondiendo? Y cuándo
  deriva a una persona (define `shouldHandOff`).
- Fondo fijo de caja, texto del recordatorio, carga inicial de sellos de las tarjetas de cartón.

---

## Fase 1 · Jue 24 – Vie 25 a la mañana: agente multi-proveedor + riesgos (1,5 días)

1. **Proveedor intercambiable** (ver "Modelo del agente"):
   - `src/lib/agent/providers/types.ts`: una interfaz `ModelProvider` con
     `runTurn({ system, contextNote, history, tools }) → { text?, toolCalls[], stop, usage }`,
     en términos propios y neutrales.
   - `providers/gemini.ts`: implementación con `@google/genai`, a verificar en su doc:
     `functionDeclarations`, modo de llamada de funciones y el ID exacto del modelo
     3.5 Flash-Lite. El contexto volátil va pegado al último mensaje del cliente.
   - `providers/anthropic.ts`: el código actual de `run.ts` movido acá. `betas`/`fallbacks`
     sólo para Opus 5 y Fable; `effort` sólo para los modelos que lo aceptan.
   - `run.ts` se queda con el loop (máximo 6 vueltas, ejecutar herramientas, manejo de
     errores) y no conoce a ningún proveedor. `tools.ts` define las herramientas una sola vez
     en JSON Schema, y cada proveedor las traduce.
   - `config.ts`: `AGENT_PROVIDER=gemini|anthropic` más `AGENT_MODEL`, y la clave que
     corresponda (`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`). Por defecto, Gemini 3.5 Flash-Lite
     **con facturación activada**: en la capa gratuita Google usa el contenido para mejorar
     sus productos.
   - `agent_runs` guarda proveedor, modelo, tokens y costo estimado de cada corrida.
   - Tests con Vitest para la traducción de herramientas y resultados de cada proveedor, sin
     llamar a la red.
   ✅ Hecho el 23/09.
2. **El agente contra las APIs reales.** ✅ Gemini probado el 23/09: precio, reserva completa
   (el turno aparece en la agenda), fechas relativas, día cerrado, queja → persona, servicio
   que no hacen. ~2 s por respuesta, ~USD 0,0015 por mensaje. Se corrigieron dos cosas que
   aparecieron: la herramienta de disponibilidad sólo mostraba horarios de la mañana (se sumó
   `desde_hora`) y, sin lugar en la franja pedida, el modelo inventaba horas (ahora recibe las
   reales más cercanas). Timeout de 20 s por llamada. Falta comparar con Claude Haiku.
   ✅ 24/09: datos reales cargados (barberos, precios, turnos de 1 h en punto). Encontrado en
   prueba: pidieron las 14, estaba ocupado y el modelo agendó las 19 sin preguntar. Ahora el
   código sólo agenda una hora que el cliente pidió o aceptó (`src/lib/agent/consent.ts`). En localhost, con el playground de `/agente`,
   recorrer los mismos casos con Gemini 3.5 Flash-Lite y con Claude Haiku 4.5: reservar,
   reprogramar, cancelar, fechas relativas ("el sábado a la tarde", "mañana después de las
   6"), preguntar precio, consultar fidelidad, pedir hablar con una persona, fuera de
   horario. Anotar aciertos y costo, y con eso se elige el valor por defecto.
3. **Primer deploy en Railway del estado actual** (`next start` respeta `PORT`; Railpack
   detecta Next). Así se descubren temprano los problemas del entorno (build con Google
   Fonts, variables, `after()` en servidor propio).
4. **Congelar la demo de Vercel:** apuntar ese proyecto a una rama `demo`, para que siga
   sirviendo de vidriera de ventas y no se rompa cuando `main` pase a Supabase.

## Fase 2 · Vie 25 a la tarde – Lun 28: base real + login (el grueso, ~2,5 días, usa el colchón del sábado 26)

La promesa de la arquitectura: **se reescribe lo de adentro de la capa de datos, las pantallas
no se tocan.**

1. **Migraciones nuevas** (`supabase/migrations/0002_*.sql`), probadas con `npm run test:db`:
   - `payments.appointment_id` hoy es `unique` y tiene `check amount = list_price - discount + tip`.
     **Una seña más el cobro final son dos pagos del mismo turno**: hay que cambiar esa
     restricción o agregar una tabla `deposits`.
   - Columna `hold_expires_at` en `appointments`, para los turnos pendientes de seña.
   - Tabla de configuración (fondo de caja, monto de seña, plantilla del recordatorio) y
     marca `reminder_sent_at`.
2. **Clientes de Supabase:** uno con la sesión del usuario (pantallas, RLS) y otro de
   servicio (webhook, agente, cron). Generar tipos con `generate_typescript_types`.
3. **Reemplazar los cuerpos, manteniendo las firmas:**
   - `src/lib/data/repo.ts`: `db()` desaparece; `now()` pasa a ser `new Date()` real.
   - `src/lib/data/queries.ts`: una consulta por pantalla, con los mismos tipos de salida.
   - `src/lib/data/actions.ts`: inserts y updates. Crear turno depende del `EXCLUDE`: capturar
     el error `23P01` y devolver el mismo texto que hoy.
   - `src/lib/agent/tools.ts` y `src/lib/agent/respond.ts`: las mismas consultas. La ingesta
     de mensajes deduplica por id externo con `on conflict do nothing`.
   - `freeSlots` y `loyaltyStatus` (`src/lib/domain/`) **no cambian**: reciben los datos de
     la base en vez de la memoria.
4. **Login con Supabase Auth** (email + contraseña, cuentas creadas a mano, sin registro
   público). Proteger `(panel)` con el proxy de Next 16 (leer
   `node_modules/next/dist/docs/` antes: `middleware` cambió de nombre). Usar `getClaims()`
   y no `getUser()` (ver la memoria sobre la carrera de sesión). `/reservar` y
   `/api/*` quedan públicos.
5. **Ajustes editables:** servicios, precios, barberos, horarios y fondo de caja. Hoy es sólo
   lectura, y con datos que faltan y precios que cambian con la inflación, el dueño tiene que
   poder tocarlos sin pedirnos nada.
6. **Cierre de caja persistente** (`cash_sessions`, hoy es un TODO en `caja-view.tsx`).
7. **Script de carga inicial** (`scripts/seed-prod.mjs`): barberos, servicios y clientes
   reales. El `seed.ts` de demo queda sólo para la rama `demo`.

## Fase 3 · Mar 29: Zernio real + agente en producción (1 día)

1. Sesión con el dueño (la de 0.2): conectar los canales y registrar el webhook
   `https://<dominio-railway>/api/zernio/webhook` con su secreto.
2. **`sendStaffMessage` enviando por Zernio de verdad** (hoy sólo guarda: TODO en
   `actions.ts`), con Idempotency-Key, y guardando el mensaje con el id que devuelve Zernio.
3. **Que no se pierda ningún mensaje:** `after()` corre en memoria, así que si Railway
   reinicia el contenedor en medio de una respuesta, esa respuesta se pierde. Solución: una
   tarea cada 5 minutos que busca conversaciones en modo IA con un mensaje del cliente sin
   responder hace más de 2 minutos y las reintenta (o las marca para una persona).
4. **Pedir la plantilla de recordatorio a Meta ese mismo día** (a través de Zernio), porque
   la aprobación tarda.
5. Agente activo según la autonomía que defina el dueño, con **`shouldHandOff`** implementada
   (`src/lib/agent/handoff.ts`, la política queda del lado de Santiago).

## Fase 4 · Mié 30: seña con Mercado Pago (1 día)

1. En `/reservar`: el turno se crea `pendiente` con `hold_expires_at` a 15 minutos, se crea
   una preferencia de Checkout Pro y se redirige al pago. El pendiente ya bloquea el horario
   (está en los estados que `freeSlots` considera ocupados).
2. **Webhook `/api/mercadopago/webhook`:** validar la firma (`x-signature`), consultar el pago
   a la API (nunca confiar en el cuerpo), registrar la seña y pasar el turno a `confirmado`.
   Idempotente, porque MP reintenta.
3. La tarea cada 5 minutos también **libera las reservas vencidas** (el turno pasa a
   `cancelado` y el horario se libera).
4. Agente: si el turno lleva seña, `crear_turno` lo deja pendiente y el agente manda el link.
5. Caja: al cobrar, se descuenta la seña ya pagada del total.

## Fase 5 · Jue 01: recordatorios + endurecer (1 día)

1. **Recordatorios:** la misma tarea programada manda, a los turnos de mañana sin
   `reminder_sent_at`, la plantilla aprobada. Si el cliente responde, entra por la bandeja y
   el agente puede reprogramar o cancelar. Si Meta todavía no aprobó, se entrega apagado con
   un interruptor en Ajustes.
2. **Tareas programadas en Railway:** un servicio cron (mismo repo) que llama a
   `/api/cron/tick` con un secreto. Hay que verificar el intervalo mínimo de Railway
   (creemos que son 5 minutos).
3. **Seguridad:** límite de pedidos en `/reservar` y en `crear turno` públicos, correr la
   skill `cybersecurity` (auditoría antes de entregar), revisar RLS con `get_advisors`,
   que ningún secreto sea `NEXT_PUBLIC_`.
4. **Costos a la vista:** registrar cada corrida del agente en `agent_runs` (tokens y costo)
   y tener un límite de gasto en la consola de Anthropic.

## Fase 6 · Vie 02: entrega

- Carga de datos reales, cuentas del equipo, dominio (subdominio de operonhub o el del local).
- Recorrido completo en producción con un celular de prueba escribiendo por WhatsApp.
- Capacitación de unos 30 minutos con el dueño y una guía de una página.
- Actualizar `README.md`, `AGENTS.md` y `docs/PLAN.md`, que siguen diciendo "modo demo".

**Colchón:** el sábado 26 y el viernes a la mañana. **Si algo se atrasa, lo primero que cae
es Mercado Pago** (se puede cobrar la seña por transferencia a mano la primera semana). Los
recordatorios se entregan apagados si Meta no aprobó.

---

## Modelo del agente

El trabajo es acotado (castellano rioplatense, fechas relativas, 7 herramientas, respuestas
cortas). El proveedor queda **intercambiable por variable**, así el modelo se elige por
barbería según costo y resultados.

| Modelo | USD por millón (entrada / salida) | 300 conversaciones/mes |
|---|---|---|
| **Gemini 3.5 Flash-Lite (por defecto, pago)** | 0,30 / 2,50 | ~USD 2,50 |
| Gemini 2.5 Flash-Lite | 0,10 / 0,40 | ~USD 0,60 (más errores con fechas) |
| Claude Haiku 4.5 (alternativa) | 1 / 5 | ~USD 7 |

- Supuesto: ~15.000 tokens de entrada y ~1.500 de salida por conversación. Los precios de
  Gemini son de ai.google.dev al 23/09. El costo real sale de `agent_runs`.
- Nada de capas gratuitas: Google usa ese contenido para mejorar sus productos, y son chats
  de clientes reales.
- **El modelo propone, el código decide:** con un modelo chico, lo peor que pasa es una
  respuesta torpe o una derivación de más, nunca un doble turno.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo barato se equivoca agendando | Se prueba el jueves 24 contra Haiku con los mismos casos, y cambiar de modelo es cambiar una variable. El código revalida cada turno igual |
| Reescribir el agente come tiempo de la semana | Se acota a 1,5 días. Si se pasa, Claude queda por defecto (ya anda) y Gemini se activa después |
| Meta no aprueba la plantilla a tiempo | Pedirla el martes 29 y entregar con el interruptor apagado |
| El dueño no manda los datos | Ajustes editables: se entrega con supuestos marcados y los carga él |
| Supabase gratis no tiene backups | Pasar a Pro (USD 25 por mes) o exportar a diario; definirlo con el cliente en el abono mensual |
| Railway reinicia en medio de una respuesta | Tarea que recupera mensajes sin responder (Fase 3.3) |

## Archivos clave

`src/lib/data/{repo,queries,actions}.ts`, `src/lib/agent/{config,run,tools,respond,handoff}.ts`,
nuevo `src/lib/agent/providers/{types,gemini,anthropic}.ts`, `.env.example`,
`src/app/api/zernio/webhook/route.ts`, nuevos `src/app/api/{mercadopago/webhook,cron/tick}/route.ts`,
`supabase/migrations/0002_*.sql`, `src/app/(panel)/ajustes/page.tsx`,
`src/components/caja/caja-view.tsx`, `src/app/reservar/page.tsx` + `booking-flow.tsx`.


## Verificación en cada fase

- Siempre: `npx tsc --noEmit`, `npm run lint`, `npm test`, y `npm run test:db` si se
  tocaron las migraciones.
- Fase 2: `scripts/verify.mjs` (reserva, nuevo turno, cobro) contra la base real. Un turno
  creado sobrevive a un redeploy de Railway.
- Fase 3: `scripts/webhook-smoke.mjs` contra el dominio de Railway, más un mensaje real desde
  un celular que el agente contesta.
- Fase 4: pago de prueba con usuarios de prueba de MP; una reserva vencida libera el horario.
- Fase 5: turno de prueba para mañana → llega el recordatorio.
