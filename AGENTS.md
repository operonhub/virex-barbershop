<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Virex · guía para agentes (Codex, Claude Code)

Panel de gestión para **Virex Barber Shop** (Oncativo 2022, Lanús Este, Buenos Aires):
agenda por barbero, bandeja unificada de WhatsApp + Instagram vía **Zernio**, **agente IA**
(Claude) que responde y agenda solo, caja del día, finanzas del mes, clientes con tarjeta de
fidelidad digital y reserva online pública. Lo hace **Operon** (operonhub.com).

Todo el producto (UI, comentarios, commits, copy) está en **castellano rioplatense**, con voseo.
Mantenerlo así.

## Estado actual

- **Esqueleto funcional en modo demo:** todas las pantallas funcionan con datos de ejemplo
  realistas generados en memoria (`src/lib/data/seed.ts`). No hay base conectada todavía.
- Barberos (Leo / Thiago / Bruno), precios y duraciones son **supuestos**: se confirman con el
  cliente (ver `docs/PLAN.md` → "Preguntas").
- Lo real, tomado del Instagram del local: dirección, horario (mar–sáb 11–20) y la tarjeta de
  fidelidad (5 cortes → el 6to al 50 %).
- Plan por fases y decisiones: **`docs/PLAN.md`** (leerlo antes de tareas grandes).

## Comandos

```bash
npm install
npm run dev          # http://localhost:3060
npm test             # vitest: reglas de dominio (disponibilidad, fidelidad)
npm run test:db      # corre la migración en Postgres real (PGlite) y prueba el anti doble turno
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

## Mapa del código

```
src/app/(panel)/            Pantallas del panel: page (Hoy), agenda, bandeja, clientes, caja,
                            finanzas, agente, ajustes. Server components que leen de queries.ts.
src/app/reservar/           Reserva online pública. Recibe SÓLO la ocupación, nunca datos de clientes.
src/app/api/zernio/webhook/ Webhook de mensajes entrantes (firma HMAC, dedupe, agente con after()).
src/config/brand.ts         Datos del negocio. Todo lo que dice "Virex" sale de acá.
src/lib/domain/             Reglas PURAS con tests: slots.ts (disponibilidad), loyalty.ts
                            (fidelidad), finance.ts (caja, comisiones, origen de turnos), types.ts.
src/lib/data/repo.ts        Única puerta a los datos. Hoy: estado demo en memoria (globalThis).
src/lib/data/queries.ts     Una consulta por pantalla (arma exactamente lo que la página necesita).
src/lib/data/actions.ts     Server actions (crear turno, cobrar, mensajes, modo IA/humano…).
src/lib/agent/              config, prompt, tools (7 herramientas), run (loop con Claude),
                            respond (bandeja ↔ agente ↔ Zernio), handoff (red de seguridad), actions.
src/lib/zernio/             Cliente de Zernio portado de operon-crm (probado en producción).
src/lib/time.ts             Hora argentina (−03:00 fija, sin horario de verano). `dayKey` = AAAA-MM-DD.
src/lib/money.ts            Pesos enteros (sin centavos), formatos es-AR.
src/lib/chart-palette.ts    Paleta de datos para gráficos (validada para daltonismo).
src/components/brand/       Isotipo (virex-mark), wordmark, intro, íconos de canal, sello Operon.
src/components/ui/          Componentes shadcn (base-nova, Base UI). Tocar lo mínimo.
supabase/migrations/        0001_core.sql: esquema completo + RLS + restricción EXCLUDE.
public/intro-boot.js        Decide antes del primer pintado si corre la intro.
```

## Reglas de negocio que no se rompen

- **Un solo cálculo de horarios libres:** `freeSlots` / `freeSlotsAnyStaff` en
  `lib/domain/slots.ts`. Lo usan el agente, el diálogo de nuevo turno y la reserva web. No
  duplicar esa lógica en ningún componente.
- **El doble turno lo frena la base**, no sólo la app: `appointments_no_overlap` (EXCLUDE sobre
  `tstzrange(starts_at, ends_at, '[)')` por barbero; cancelados y no-show liberan la silla).
- **La fidelidad se deriva de los pagos**, no se guarda un contador. El descuento lo recalcula
  el servidor al cobrar (`chargeAppointment`), nunca lo decide la pantalla.
- **"Ahora" es el reloj de la demo:** usar `now()` de `repo.ts` y pasar `now` a los
  componentes; no usar `new Date()` para cuentas relativas al presente. Con el local cerrado,
  la demo simula el último día hábil a las 16:40 (`demoClock`); `DEMO_CLOCK=real` lo apaga.
- Si cambiás el generador de datos (`seed.ts`), subí `SEED_VERSION` o el estado en memoria no
  se regenera hasta el día siguiente.

## El agente IA

- Loop manual con `@anthropic-ai/sdk` (`client.beta.messages.create`), modelo por defecto
  `claude-opus-5` con `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
  `AGENT_MODEL` / `AGENT_EFFORT` lo cambian. Máximo 6 iteraciones.
- Prompt en dos partes: `buildSystemPrompt` es **estable** (negocio, servicios, reglas del
  dueño) y lleva `cache_control`; no meterle fecha, hora ni nada que cambie por mensaje. Lo
  volátil va en `buildContextNote`, al final, como mensaje de sistema (o pegado al último
  mensaje del cliente en modelos que no lo soportan: ver `supportsMidConversationSystem`).
- Herramientas con `strict: true`. **El modelo propone, el código decide:** cada herramienta
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

## Próximos pasos (ver docs/PLAN.md)

1. Confirmar datos con el cliente (servicios, precios, barberos, comisiones, seña, fidelidad).
2. Supabase: aplicar `0001_core.sql`, reemplazar el cuerpo de `repo.ts` / `queries.ts` /
   `actions.ts` / `agent/tools.ts` por consultas; login para el equipo.
3. Zernio real: conectar WhatsApp (Coexistence) e Instagram, registrar el webhook, backfill.
4. Recordatorios por WhatsApp (plantilla aprobada por Meta) y Mercado Pago si cobran seña.
5. Deploy: Vercel del equipo Operon.

## Variables de entorno

Ver `.env.example`. Todas son de servidor (nada de `NEXT_PUBLIC_` salvo las de Supabase).
Nunca commitear `.env.local`.
