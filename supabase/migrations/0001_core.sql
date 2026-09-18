-- ─────────────────────────────────────────────────────────────────────────
-- Virex — esquema inicial
--
-- Espeja los tipos de src/lib/domain/types.ts. Plata en pesos enteros (ARS
-- sin centavos). Fechas en timestamptz (UTC); la app las muestra en hora
-- argentina (−03:00 fija).
--
-- Una sola barbería por base (single-tenant). Si el producto se vende a otras
-- barberías, cada una va en su propio proyecto de Supabase: más simple y más
-- seguro que un multi-tenant para este volumen.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists btree_gist; -- para la restricción anti doble turno
create extension if not exists pgcrypto;

-- ── Equipo y acceso ─────────────────────────────────────────────────────

create table staff (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  role             text not null check (role in ('dueno', 'barbero', 'recepcion')),
  commission_pct   smallint not null default 0 check (commission_pct between 0 and 100),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Cada usuario de Supabase Auth es una persona del equipo.
create table profiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  staff_id  uuid unique references staff (id),
  role      text not null check (role in ('dueno', 'barbero', 'recepcion'))
);

create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid())
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'dueno')
$$;

-- ── Catálogo ────────────────────────────────────────────────────────────

create table services (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  category             text not null check (category in ('corte', 'barba', 'combo', 'color', 'extra')),
  duration_min         smallint not null check (duration_min between 5 and 480),
  price                integer not null check (price >= 0),
  counts_for_loyalty   boolean not null default false,
  active               boolean not null default true,
  sort                 smallint not null default 0
);

-- Servicios que un barbero NO hace (ej. color). Vacío = hace todos.
create table staff_service_exclusions (
  staff_id    uuid references staff (id) on delete cascade,
  service_id  uuid references services (id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ── Clientes ────────────────────────────────────────────────────────────

create table clients (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  phone               text unique,                 -- E.164: +54911…
  instagram           text unique,
  channel             text check (channel in ('whatsapp', 'instagram')),
  cut_notes           text,                        -- "degradé bajo, 1,5 a los costados"
  notes               text,
  preferred_staff_id  uuid references staff (id),
  created_at          timestamptz not null default now()
);
create index clients_name_idx on clients using gin (to_tsvector('simple', name));

-- ── Turnos ──────────────────────────────────────────────────────────────

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients (id),
  staff_id         uuid not null references staff (id),
  service_id       uuid not null references services (id),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           text not null default 'confirmado'
                   check (status in ('pendiente', 'confirmado', 'en_curso', 'completado', 'cancelado', 'no_show')),
  source           text not null check (source in ('agente', 'panel', 'web', 'walk_in')),
  price            integer not null check (price >= 0),  -- precio de lista al reservar
  notes            text,
  conversation_id  uuid,                                 -- FK abajo (conversations se crea después)
  created_by       uuid references auth.users (id),      -- null = agente o web
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at),

  -- LA garantía contra el doble turno. El agente y una persona pueden
  -- reservar el mismo hueco en el mismo segundo: el chequeo de la app sugiere,
  -- esta restricción decide. Cancelados y no-show liberan la silla.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelado', 'no_show'))
);
create index appointments_day_idx on appointments (starts_at);
create index appointments_client_idx on appointments (client_id, starts_at desc);

-- ── Plata ───────────────────────────────────────────────────────────────

create table cash_sessions (
  id             uuid primary key default gen_random_uuid(),
  opened_at      timestamptz not null default now(),
  opening_cash   integer not null default 0,
  closed_at      timestamptz,
  expected_cash  integer,
  counted_cash   integer,
  difference     integer generated always as (counted_cash - expected_cash) stored,
  closed_by      uuid references auth.users (id),
  notes          text
);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid unique references appointments (id), -- un turno se cobra una vez
  client_id        uuid references clients (id),
  staff_id         uuid references staff (id),
  service_id       uuid references services (id),
  concept          text not null,
  kind             text not null check (kind in ('servicio', 'producto')),
  list_price       integer not null check (list_price >= 0),
  discount         integer not null default 0 check (discount >= 0),
  discount_reason  text check (discount_reason in ('fidelidad', 'manual')),
  tip              integer not null default 0 check (tip >= 0),
  amount           integer not null,            -- list_price − discount + tip
  method           text not null check (method in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito')),
  external_ref     text,                        -- id de pago de Mercado Pago, si aplica
  cash_session_id  uuid references cash_sessions (id),
  paid_at          timestamptz not null default now(),
  created_by       uuid references auth.users (id),
  check (amount = list_price - discount + tip)
);
create index payments_day_idx on payments (paid_at);
create index payments_client_idx on payments (client_id, paid_at);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  category     text not null check (category in ('alquiler', 'servicios', 'insumos', 'sueldos', 'marketing', 'otros')),
  description  text not null,
  amount       integer not null check (amount > 0),
  method       text not null check (method in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito')),
  paid_at      timestamptz not null default now(),
  created_by   uuid references auth.users (id)
);

-- La tarjeta de fidelidad NO tiene tabla: se deriva de `payments`
-- (src/lib/domain/loyalty.ts). Así no hay contador que se desincronice
-- si se anula un cobro.

-- ── Bandeja (Zernio) ────────────────────────────────────────────────────

create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  zernio_id           text unique not null,
  zernio_account_id   text not null,
  channel             text not null check (channel in ('whatsapp', 'instagram')),
  client_id           uuid references clients (id),
  participant_name    text,
  participant_handle  text,
  mode                text not null default 'ia' check (mode in ('ia', 'humano')),
  needs_human         boolean not null default false,
  handoff_reason      text,
  unread              integer not null default 0,
  last_message_at     timestamptz,
  last_inbound_at     timestamptz   -- ventana de 24 h de WhatsApp
);
alter table appointments
  add constraint appointments_conversation_fk foreign key (conversation_id) references conversations (id);

create table messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations (id) on delete cascade,
  zernio_id        text unique,       -- dedupe de reintentos del webhook
  author           text not null check (author in ('cliente', 'ia', 'staff')),
  staff_id         uuid references staff (id),
  body             text,
  attachments      jsonb,
  action           text check (action in ('turno_creado', 'turno_reprogramado', 'turno_cancelado',
                                          'consulta_respondida', 'derivado_humano', 'sello_consultado')),
  delivery_status  text not null default 'sent' check (delivery_status in ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at          timestamptz not null default now()
);
create index messages_conversation_idx on messages (conversation_id, sent_at);

-- Registro crudo de webhooks: índice único = deduplicación at-least-once.
create table webhook_events (
  zernio_event_id  text primary key,
  event_type       text not null,
  payload          jsonb not null,
  status           text not null default 'processed',
  received_at      timestamptz not null default now()
);

-- ── Agente ──────────────────────────────────────────────────────────────

create table agent_settings (
  id           smallint primary key default 1 check (id = 1), -- una sola fila
  enabled      boolean not null default true,
  name         text not null default 'Asistente Virex',
  tone         text not null default 'cercano' check (tone in ('cercano', 'profesional', 'canchero')),
  channels     jsonb not null default '{"whatsapp": true, "instagram": true}',
  permissions  jsonb not null default '{"answerPrices": true, "book": true, "reschedule": true, "cancel": true, "shareLoyalty": true}',
  rules        text[] not null default '{}',
  after_hours_note text not null default '',
  updated_at   timestamptz not null default now()
);
insert into agent_settings (id) values (1);

-- Cada corrida del agente: para auditar qué hizo y cuánto costó.
create table agent_runs (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references conversations (id),
  model            text not null,
  ok               boolean not null,
  failure_reason   text,
  tools            jsonb not null default '[]',   -- [{tool, action, isError}]
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0,
  cache_read_tokens integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ── Seguridad (RLS) ─────────────────────────────────────────────────────
-- Todo cerrado por defecto. El equipo opera la barbería; la plata del mes
-- (gastos, cierres) y la configuración del agente sólo los toca el dueño.
-- El webhook y el agente escriben con la service role desde el servidor.

alter table staff enable row level security;
alter table profiles enable row level security;
alter table services enable row level security;
alter table staff_service_exclusions enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table cash_sessions enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table webhook_events enable row level security;  -- sin políticas: sólo service role
alter table agent_settings enable row level security;
alter table agent_runs enable row level security;

create policy team_read on staff for select using (is_member());
create policy owner_write on staff for all using (is_owner()) with check (is_owner());
create policy self_read on profiles for select using (id = auth.uid() or is_owner());

create policy team_read on services for select using (is_member());
create policy owner_write on services for all using (is_owner()) with check (is_owner());
create policy team_read on staff_service_exclusions for select using (is_member());
create policy owner_write on staff_service_exclusions for all using (is_owner()) with check (is_owner());

create policy team_all on clients for all using (is_member()) with check (is_member());
create policy team_all on appointments for all using (is_member()) with check (is_member());
create policy team_all on conversations for all using (is_member()) with check (is_member());
create policy team_all on messages for all using (is_member()) with check (is_member());

-- Cobrar lo hace cualquiera del equipo; anular o corregir, sólo el dueño.
create policy team_read on payments for select using (is_member());
create policy team_insert on payments for insert with check (is_member());
create policy owner_fix on payments for update using (is_owner()) with check (is_owner());

create policy team_insert on expenses for insert with check (is_member());
create policy owner_read on expenses for select using (is_owner());
create policy owner_all on cash_sessions for all using (is_owner()) with check (is_owner());
create policy team_open on cash_sessions for insert with check (is_member());

create policy team_read on agent_settings for select using (is_member());
create policy owner_write on agent_settings for update using (is_owner()) with check (is_owner());
create policy owner_read on agent_runs for select using (is_owner());
