-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0002: lo que salió de la reunión y de las pruebas del agente
--
-- Principio: "la IA traduce, la base decide". Todo lo que el agente, el panel
-- o la reserva web necesitan para decidir si un turno se puede dar tiene que
-- estar acá, no en la cabeza del modelo:
--   · horario de cada barbero (no todos trabajan todos los días)
--   · francos, vacaciones y bloqueos puntuales
--   · turnos pendientes de seña que vencen solos
--   · configuración del local editable (fondo de caja, seña, recordatorios)
-- ─────────────────────────────────────────────────────────────────────────

-- ── Horario de cada barbero ─────────────────────────────────────────────
-- Una fila por franja. Un barbero puede tener dos franjas el mismo día
-- (ej. 11–14 y 16–20). Sin filas = no trabaja ese día.
create table staff_schedules (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0 = domingo
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index staff_schedules_staff_idx on staff_schedules (staff_id, weekday);

-- ── Francos, vacaciones, turno médico ───────────────────────────────────
create table staff_time_off (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index staff_time_off_range_idx on staff_time_off (staff_id, starts_at);

-- ── Turnos: seña pendiente y recordatorio ───────────────────────────────
alter table appointments
  add column hold_expires_at   timestamptz,   -- pendiente de seña: si vence sin pago, se cancela solo
  add column reminder_sent_at  timestamptz;   -- recordatorio del día anterior ya enviado

create index appointments_hold_idx on appointments (hold_expires_at) where hold_expires_at is not null;

-- ── Seña: dos pagos para un mismo turno ─────────────────────────────────
-- Antes, `appointment_id` era único (un turno, un cobro). Con seña, un turno
-- tiene la seña (Mercado Pago) y después el cobro final en el local. Sigue
-- habiendo UN solo cobro de servicio por turno.
alter table payments drop constraint payments_appointment_id_key;
alter table payments drop constraint payments_kind_check;
alter table payments add constraint payments_kind_check check (kind in ('servicio', 'producto', 'sena'));
create unique index payments_one_service_per_appointment on payments (appointment_id) where kind = 'servicio';
create unique index payments_one_deposit_per_appointment on payments (appointment_id) where kind = 'sena';
create unique index payments_external_ref_idx on payments (external_ref) where external_ref is not null; -- MP reintenta el webhook

-- ── Configuración del local (una sola fila) ─────────────────────────────
create table shop_settings (
  id                 smallint primary key default 1 check (id = 1),
  opening_cash       integer not null default 0 check (opening_cash >= 0),
  deposit_enabled    boolean not null default false,
  deposit_amount     integer not null default 0 check (deposit_amount >= 0),
  deposit_hold_min   smallint not null default 15 check (deposit_hold_min between 5 and 120),
  reminders_enabled  boolean not null default false,  -- se prende cuando Meta aprueba la plantilla
  reminder_template  text,                             -- nombre de la plantilla aprobada en WhatsApp
  updated_at         timestamptz not null default now()
);
insert into shop_settings (id) values (1);

-- ── Bandeja: referencia de la acción del agente ─────────────────────────
alter table messages add column action_ref text;   -- ej. id del turno que creó

-- ── Agente: proveedor y costo de cada corrida ───────────────────────────
alter table agent_runs
  add column provider           text not null default 'gemini' check (provider in ('gemini', 'anthropic')),
  add column cache_write_tokens integer not null default 0,
  add column cost_usd           numeric(10, 6);

-- Cierre de caja: quién cerró puede no ser un usuario de Supabase todavía
-- (login simple con contraseña compartida). Se guarda el nombre.
alter table cash_sessions add column closed_by_name text;

-- ── Seguridad ───────────────────────────────────────────────────────────
-- Mismo criterio que 0001: todo cerrado. Hoy el servidor accede con una
-- conexión privada (el panel tiene su propio login); las políticas por
-- usuario quedan listas para cuando haya cuentas del equipo.
alter table staff_schedules enable row level security;
alter table staff_time_off enable row level security;
alter table shop_settings enable row level security;

create policy team_read on staff_schedules for select using (is_member());
create policy owner_write on staff_schedules for all using (is_owner()) with check (is_owner());
create policy team_read on staff_time_off for select using (is_member());
create policy team_write on staff_time_off for all using (is_member()) with check (is_member());
create policy team_read on shop_settings for select using (is_member());
create policy owner_write on shop_settings for update using (is_owner()) with check (is_owner());
