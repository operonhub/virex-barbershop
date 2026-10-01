<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Virex · guía para agentes (Codex, Claude Code)

Panel de gestión para **Virex Barber Shop** (Oncativo 2022, Lanús Este, Buenos Aires):
agenda por barbero, bandeja unificada de WhatsApp + Instagram vía **Zernio**, **agente IA**
(Gemini o Claude) que responde y agenda solo, caja del día, finanzas del mes, clientes con tarjeta de
fidelidad digital y reserva online pública. Lo hace **Operon** (operonhub.com).

Todo el producto (UI, comentarios, commits, copy) está en **castellano rioplatense**, con voseo.
Mantenerlo así.

## Estado actual

- **Conectado a Supabase** (proyecto `virex-barbershop`, us-east-1) cuando hay `DATABASE_URL`;
  sin ella, en desarrollo, usa la demo en memoria (`src/lib/data/seed.ts`). La rama `demo`
  (Vercel) es la vidriera de ventas con datos inventados.
- **Datos reales (24/09):** mar–sáb de 11 a 20; barberos **Santiago, Sebastián y Nehemías**;
  **Corte $15.000** y **Corte + barba $20.000**; los turnos duran **una hora** (cada servicio tiene su
  duración) y el agente y la web ofrecen horarios en punto. Ese intervalo (30, 45 o 60 min) se
  cambia en Ajustes → Local (`shopSettings.slotStepMin`; `BRAND.booking.slotStepMin` es sólo el
  valor por defecto). Más la dirección y la tarjeta
  de fidelidad (5 cortes → el 6to al 50 %).
- Siguen siendo **supuestos**: quién es el dueño en el sistema (hoy Santiago) y las comisiones
  (50 %). Ver `docs/ROADMAP.md` → datos a pedir.
- Plan por fases y decisiones: **`docs/PLAN.md`** (leerlo antes de tareas grandes).

## Comandos

```bash
npm install
npm run dev          # http://localhost:3060
npm test             # vitest: reglas de dominio (disponibilidad, fidelidad)
npm run test:db      # corre las migraciones en Postgres real (PGlite): doble turno, doble cobro, seña
npm run test:integration  # contra la base REAL (DATABASE_URL): crea datos "PRUEBA ·" y los borra
npm run lint         # ESLint + React Compiler (los errores del compiler son errores reales)
npx tsc --noEmit
npm run build        # cortar `npm run dev` antes: el build pisa .next/ y el dev queda en 404
```

Antes de dar una tarea por terminada: `npx tsc --noEmit`, `npm run lint` y `npm test` en verde.
Si tocaste `supabase/migrations/`, también `npm run test:db`.

Verificación visual (Playwright con el Chrome instalado, sin descargar Chromium):
`node scripts/shot.mjs <ruta> <nombre> [ancho] [alto] [--full]` → `shots/` (ignorado por git),
`node scripts/verify.mjs` (reserva pública, nuevo turno y cobro de punta a punta),
`node scripts/console-check.mjs` (errores de consola en todas las páginas),
`node scripts/intro-frames.mjs` (cuadros exactos de la intro) y
`node scripts/webhook-smoke.mjs` (webhook firmado de Zernio; necesita `ZERNIO_WEBHOOK_SECRET`
en `.env.local`). Todos esperan el dev server en el puerto 3060.
En Windows con Git Bash, anteponer `MSYS_NO_PATHCONV=1` (si no, `/agenda` llega como ruta de disco).

**En entornos en la nube (Codex cloud, CI):** no hay Chrome instalado, así que los scripts de
Playwright no corren (usan `channel: "chrome"`); la verificación ahí es `tsc` + `lint` +
`npm test` + `npm run test:db`, que no necesitan navegador ni red. `npm run build` descarga
la fuente Archivo de Google Fonts (`next/font/google`): sin acceso a internet falla por eso,
no por el código.

## Mapa del código

```
src/app/(panel)/            Pantallas del panel: page (Hoy), agenda, bandeja, clientes, caja,
                            finanzas, agente, ajustes. Server components que leen de queries.ts.
src/app/reservar/           Reserva online pública. Recibe SÓLO la ocupación, nunca datos de clientes.
src/app/api/zernio/webhook/ Webhook de mensajes entrantes (firma HMAC, dedupe, agente con after()).
src/config/brand.ts         Datos del negocio. Todo lo que dice "Virex" sale de acá.
src/lib/domain/             Reglas PURAS con tests: slots.ts (disponibilidad), loyalty.ts
                            (fidelidad), finance.ts (caja, comisiones, origen de turnos), types.ts.
src/lib/data/repo.ts        Única puerta a los datos: `db()` (lee), `store()` (escribe), `now()`.
src/lib/data/store/         La interfaz `Store` y sus dos implementaciones: memory.ts (demo) y
                            postgres.ts (Supabase, con `postgres`). Los errores de la base se
                            traducen: 23P01 → SlotTakenError, 23505 en cobros → AlreadyChargedError.
src/lib/data/queries.ts     Una consulta por pantalla (arma exactamente lo que la página necesita).
src/lib/data/actions.ts     Server actions (crear turno, cobrar, cobro rápido, cerrar caja, mensajes…).
src/lib/data/settings-actions.ts  Ajustes: servicios, equipo, horario semanal, francos, fondo de caja.
src/components/settings/    Editores de Ajustes (servicios, equipo con horario y francos, local).
src/lib/agent/              config, prompt, tools (7 herramientas), run (loop), providers/ (Gemini, Claude),
                            respond (bandeja ↔ agente ↔ Zernio), handoff (red de seguridad), actions.
src/lib/zernio/             Cliente de Zernio portado de operon-crm. deliver.ts: manda al canal
                            correcto (ventana de 24 h de WhatsApp), lo usan el agente y la Bandeja.
                            actions.ts: genera el link para que el DUEÑO conecte WhatsApp/Instagram.
src/app/conectado/          Página pública (sin login) adonde vuelve el dueño tras conectar.
src/lib/time.ts             Hora argentina (−03:00 fija, sin horario de verano). `dayKey` = AAAA-MM-DD.
src/lib/money.ts            Pesos enteros (sin centavos), formatos es-AR.
src/lib/chart-palette.ts    Paleta de datos para gráficos (validada para daltonismo).
src/components/brand/       Isotipo (virex-mark), wordmark, intro, íconos de canal, sello Operon.
src/components/ui/          Componentes shadcn (base-nova, Base UI). Tocar lo mínimo.
supabase/migrations/        0001 esquema + RLS + EXCLUDE · 0002 horarios por barbero, francos, seña,
                            config del local · 0003 endurecer (revisor de seguridad de Supabase) ·
                            0004 cierre de caja (uno por día, `business_day` único) ·
                            0005 turnos fijos (`fixed_slots`: semanales o de un día, bloquean
                            `freeSlots` como un franco; `db()` los suma a `staff.timeOff`; se ven
                            en la Agenda y en "La jornada" como bloques rayados hasta que un turno
                            real los ocupa: `fixedSlotsOn` / `pendingFixedSlots`) ·
                            0006 historial importado del Excel (`payments.imported/units`,
                            `expenses.imported`; se carga con `scripts/importar-historial.mjs`,
                            reglas en `src/lib/import/historial.ts`; las tarjetas de fidelidad de
                            cartón se cargaron con `scripts/importar-tarjetas.mjs` como sellos de
                            $0 marcados `imported`, porque la fidelidad se deriva de los cobros) · 0007 intervalo de horarios
                            (`shop_settings.slot_step_min`: 30, 45 o 60).
supabase/seed.sql           Datos reales (barberos, servicios, horarios, reglas del agente). Idempotente.
public/intro-boot.js        Decide antes del primer pintado si corre la intro.
```

## Acceso al panel (login simple)

- Una contraseña para todo el equipo: `PANEL_PASSWORD` (`src/lib/auth/session.ts`). La cookie
  guarda una firma derivada de la contraseña, no la contraseña; cambiarla cierra todas las
  sesiones. En producción, sin `PANEL_PASSWORD`, el panel queda **cerrado**; en desarrollo,
  abierto.
- `src/proxy.ts` (el middleware de Next 16) manda a `/login` todo menos `/reservar`, `/api/*`,
  `/login` y los estáticos. **Además cada server action del panel llama a
  `assertPanelSession()`**: una server action se puede invocar por POST desde otra ruta, así que
  el proxy solo no alcanza. Toda action nueva del panel tiene que empezar con esa línea.
- La reserva pública usa su propia action, `createPublicBooking` (sin sesión, acepta menos:
  cliente nuevo, origen web, grilla del local). No reutilizar `createAppointment` ahí.
- Se reemplaza por usuarios de Supabase Auth en la Fase 2.

## Cobro rápido (turnos sin WhatsApp)

- **Regla de oro para el equipo:** todo corte se registra en el panel, hable o no por WhatsApp.
  Lo que no está cargado, el agente lo puede ofrecer como libre (doble turno de hecho) y no
  suma a la comisión, la fidelidad ni la caja del barbero.
- `quickCharge` (`src/lib/data/actions.ts`) crea el turno YA completado (`source: "walk_in"`) y
  lo cobra en un solo paso — pantalla en `src/components/caja/quick-charge-dialog.tsx`, botón
  "Cobro rápido" en Caja. Mismas reglas que un turno normal: fidelidad recalculada por el servidor.
- **El corte YA se hizo, así que se registra TERMINANDO ahora, no empezando ahora.**
  `placeFinishedWalkIn` (`domain/slots.ts`) lo ubica en el último hueco libre del barbero
  (si el hueco es más chico que el servicio, el corte se acorta a él). Si el barbero estuvo
  ocupado hasta hace más de una hora o no hay hueco de 10 minutos, NO inventa un horario: pide
  "Cuándo fue" (`startedAt` + `durationMin`). Antes se registraba desde ahora hacia adelante y
  chocaba con el turno que ya había empezado (el EXCLUDE lo rechazaba): no dejaba cobrar.
- **Terminar antes libera el resto del horario.** `earlyFinishEnd`: al cobrar un turno, o al
  marcarlo "completado" (botón "Terminó, cobro después" de la ficha), si terminó 5 minutos o
  más antes de lo previsto, su `endsAt` se corta en ese momento. El turno completado sin
  cobrar sigue en "Por cobrar". Sin esto, un turno de 12:30 a 13:30 terminado a las 13:00
  ocupaba la silla hasta las 13:30.

## Reglas de negocio que no se rompen

- **Un solo cálculo de horarios libres:** `freeSlots` / `freeSlotsAnyStaff` en
  `lib/domain/slots.ts`. Lo usan el agente, el diálogo de nuevo turno y la reserva web. No
  duplicar esa lógica en ningún componente. Respeta el **horario propio de cada barbero**
  (`staff.schedule`, tabla `staff_schedules`; sin horario = el del local) y sus **francos**
  (`staff.timeOff`). `worksOn()` dice si atiende ese día.
- **La agenda es flexible, no cuadrada.** Lo que se OFRECE (agente, web) sale de `freeSlots`:
  grilla de Ajustes (30/45/60) **más** un horario pegado al final de cada turno o bloqueo
  (un corte de 45' que termina 17:45 ofrece 17:45, no deja un hueco muerto), y respeta las
  **varias franjas por día** de cada barbero (11 a 14 y 15 a 20; `normalizeShifts`,
  `offHoursFor` en `domain/schedule.ts` y `slots.ts`). Lo que el EQUIPO carga a mano
  (Nuevo turno, Turno rápido, `checkManualBooking`) acepta **cualquier hora de 5 en 5 y
  cualquier duración**: sólo frena lo imposible (local cerrado, fuera del horario del local,
  pisar a otro cliente) y AVISA, sin trabar, lo discutible (fuera del horario del barbero,
  franco, turno fijo). Todas las horas del panel usan `components/forms/time-select.tsx`.
  Turnos fijos: no se pueden cargar dos que se pisen para el mismo barbero (`fixedSlotsClash`).
- **Chat de prueba del agente en ensayo** con la base real (`ToolContext.dryRun`): corre todas
  las validaciones y no escribe nada. En la demo en memoria sí agenda.
- **El doble turno lo frena la base**, no sólo la app: `appointments_no_overlap` (EXCLUDE sobre
  `tstzrange(starts_at, ends_at, '[)')` por barbero; cancelados y no-show liberan la silla).
- **La fidelidad se deriva de los pagos**, no se guarda un contador. El descuento lo recalcula
  el servidor al cobrar (`chargeAppointment`), nunca lo decide la pantalla.
- **"Ahora" sale de `now()` de `repo.ts`:** con la base es la hora real; en la demo, con el
  local cerrado, simula el último día hábil a las 16:40 (`demoClock`). No usar `new Date()` para
  cuentas relativas al presente.
- **Leer con `db()`, escribir con `store()`**, nunca mutar el snapshot. El snapshot de Postgres
  trae 400 días de turnos/cobros/gastos y 90 de mensajes (suficiente para fidelidad y finanzas).
- **Migraciones:** archivo nuevo en `supabase/migrations/`, probado con `npm run test:db`, y
  aplicado en Supabase. Nunca editar una migración ya aplicada.
- Si cambiás el generador de datos (`seed.ts`), subí `SEED_VERSION` o el estado en memoria no
  se regenera hasta el día siguiente.

## El agente IA

- **Proveedor intercambiable** (`AGENT_PROVIDER=gemini|anthropic`, `AGENT_MODEL`,
  `AGENT_EFFORT=low|medium|high`). Por defecto **Gemini 3.5 Flash-Lite** (clave de un
  proyecto con facturación); alternativa **Claude Haiku 4.5**. `run.ts` es el loop y no
  conoce proveedores: habla con una sesión neutral (`providers/types.ts`), y cada proveedor
  (`providers/gemini.ts`, `providers/anthropic.ts`) traduce y guarda su propio historial.
  Máximo 6 vueltas. Tests de la traducción en `providers/providers.test.ts`.
- En Gemini, el turno del modelo se agrega al historial tal cual vino (trae firmas de
  pensamiento). En Claude, `fallbacks` sólo va a Opus 5 / Fable y `effort` no va a Haiku.
- Prompt en dos partes: `buildSystemPrompt` es **estable** (negocio, servicios, reglas del
  dueño); no meterle fecha, hora ni nada que cambie por mensaje. Lo volátil va en
  `buildContextNote`, pegado al último mensaje del cliente (o como mensaje de sistema en los
  Claude que lo soportan).
- El playground de `/agente` muestra modelo, tokens y costo estimado de cada respuesta
  (`estimateCostUsd` en `config.ts`, precios cargados a mano).
- **La IA traduce, la base decide.** El modelo sólo convierte lo que escribe el cliente en un
  pedido concreto; toda decisión (horario libre, local abierto, barbero que hace el servicio,
  turno del cliente, y que el cliente **haya pedido o aceptado esa hora**: `consent.ts`) la toma
  el código. Regla para cualquier agente nuevo: nada queda a interpretación del modelo.
- Herramientas definidas una vez en JSON Schema (`tools.ts`). **El modelo propone, el código decide:** cada herramienta
  revalida permisos, horario libre y que el turno sea del cliente que escribe.
- Si el agente falla (sin clave, error, rechazo), la conversación pasa a humano y se marca
  en rojo. Nunca un cliente sin respuesta y sin nadie avisado.
- **Pendiente de definir con el cliente:** `shouldHandOff` en `src/lib/agent/handoff.ts`
  (hoy devuelve siempre `false`, con un TODO que explica la decisión).

## Diseño (identidad Virex)

- Paleta: obsidiana `#0B0A09`, marfil `#F2EDE3`, oro `#D6B36A`. Tokens en
  `src/app/globals.css` (`bg-obsidian`, `text-ivory-2`, `border-line`, `text-gold`…). No
  usar colores sueltos de Tailwind (`zinc-*`, `lime-*`…).
- **El oro es escaso:** sólo la acción principal de cada vista (un botón dorado por pantalla),
  el "ahora" de la agenda y la fidelidad. Nunca dos CTA dorados compitiendo.
- **Una sola familia tipográfica:** Archivo, con eje de ancho. `font-display` (125 %, títulos),
  `font-wide` (112,5 %), `font-narrow`, `num` (números tabulares), `eyebrow`. No agregar fuentes.
- Estados de turno por contorno (punteado = sin confirmar, verde = en curso, rojo = no vino),
  no con bordes laterales de color ni arco iris.
- Gráficos: `lib/chart-palette.ts`, un solo eje, texto en tokens de texto (nunca del color de la serie).
- Interacción táctil primero: se usa parado, con el celular o la tablet. Botones grandes en
  vez de selects.
- Tailwind v4 ya no pone la manito en los botones: está restituido en `globals.css`.
- El sello "Hecho por Operon" (`components/brand/operon-badge.tsx`) va en el pie del panel y de
  la página pública. No sacarlo.

## Varias cuentas de Zernio: no mezclar negocios

La API key de Zernio ve las cuentas de TODOS los profiles del usuario (Operon tiene los suyos en el
profile "Default"). Un webhook sin filtro dejó entrar el WhatsApp de otro negocio a la Bandeja.
Reglas: cada webhook en Zernio se registra con `profileIds` (el de Virex, el de Operon CRM);
`isOwnAccount` (`src/lib/zernio/own-accounts.ts`) hace que el webhook ignore y `deliverToChannel`
se niegue a enviar desde una cuenta que no sea del `ZERNIO_PROFILE_ID`, y falla cerrado en
producción si esa variable falta.

## Pantallas que se actualizan solas y reintentos

- `components/shell/auto-refresh.tsx` (en el layout del panel) hace `router.refresh()` cada 6 s en
  Bandeja y cada 20 s en Hoy, Agenda y Caja, sólo con la pestaña visible. Ajustes, Finanzas y
  Clientes no se refrescan (ahí se edita).
- `lib/retry.ts` (`retrying`) reintenta con presupuesto de tiempo (el webhook tiene 60 s): Gemini
  (`isTransientGeminiError`, 2 reintentos) y el envío por Zernio (`isTransientZernioFailure`, con la
  MISMA `Idempotency-Key` en todos los intentos para no duplicar el mensaje).

## Conectar WhatsApp e Instagram (Fase 3)

- **El dueño conecta sus propias cuentas, a distancia.** Desde Ajustes → Conexiones →
  "Generar link" (`createConnectLink` en `src/lib/zernio/actions.ts`), se copia el link y se le
  manda por WhatsApp o mail. Él lo abre en SUS dispositivos — nunca pasa contraseñas ni códigos.
- WhatsApp necesita **WhatsApp Business** (no personal) en una cuenta de **Meta Business**. Sin
  `onboarding=api` en la URL de conexión, ofrece "Coexistence": sigue usando la app en el
  celular y sólo escanea un QR — conviene abrir el link en una compu y escanear con el celular
  del local.
- Cada **profile de Zernio admite un solo WhatsApp** (`ZERNIO_PROFILE_ID`): Virex tiene el suyo.
- Vuelve a `/conectado` (pública, sin datos sensibles: sólo dice si salió bien).
- **Los ecos de lo que manda el panel se descartan** en `ingestInboxEvent` (mismo texto, mismo
  autor, últimos 5 min): si no, un mensaje del agente o de una persona se duplicaría al volver
  por el webhook.
- Un mensaje **saliente que NO es un eco** es el dueño respondiendo desde el celular
  (Coexistence): la conversación pasa a modo humano, para que el agente no le siga escribiendo
  encima.

## Próximos pasos: **`docs/ROADMAP.md`**

Entrega al cliente el viernes 02/10. El roadmap tiene el orden y el detalle por día; en
resumen:

1. Agente multi-proveedor (Gemini 3.5 Flash-Lite por defecto, Claude como alternativa) y
   prueba contra las APIs reales.
2. Supabase (migración `0002`), reemplazar el cuerpo de `repo.ts` / `queries.ts` /
   `actions.ts` / `agent/tools.ts` / `agent/respond.ts`, login, Ajustes editables.
3. Zernio real + tarea que recupera mensajes sin responder.
4. Seña con Mercado Pago.
5. Recordatorios por WhatsApp (plantilla de Meta) + endurecer.
6. **Deploy: todo en Railway** (un servicio + un cron). La demo de Vercel queda en la rama
   `demo` como vidriera de ventas.

## Variables de entorno

Ver `.env.example`. Todas son de servidor (nada de `NEXT_PUBLIC_` salvo las de Supabase).
Nunca commitear `.env.local`.
