-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0005: turnos fijos
--
-- Clientes que tienen un horario reservado de forma permanente ("los
-- martes a las 18 con Sebastián") o un día puntual. Bloquean el horario en
-- `freeSlots` igual que un franco, así el agente y la reserva web no lo
-- ofrecen y nadie tiene que cargarlo como excepción en las reglas del agente.
--
-- Una fila es SEMANAL (`weekday`) o de UN DÍA (`on_date`), nunca las dos.
-- No es un turno: no tiene cliente ni cobro. El que viene se anota con
-- "Turno rápido", que ignora estos bloques.
-- ─────────────────────────────────────────────────────────────────────────
create table fixed_slots (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references staff (id) on delete cascade,
  weekday     smallint check (weekday between 0 and 6),  -- 0 = domingo; semanal
  on_date     date,                                       -- un día puntual
  start_time  time not null,
  end_time    time not null,
  label       text,                                       -- ej. "Juan, corte y barba" (sólo lo ve el equipo)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  check (end_time > start_time),
  check ((weekday is null) <> (on_date is null))
);
create index fixed_slots_staff_idx on fixed_slots (staff_id) where active;

alter table fixed_slots enable row level security;
create policy team_read on fixed_slots for select using (is_member());
create policy team_write on fixed_slots for all using (is_member()) with check (is_member());
