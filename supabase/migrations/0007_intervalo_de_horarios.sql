-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0007: intervalo de los horarios que se ofrecen
--
-- Cada cuántos minutos arranca un turno en lo que ofrecen el agente, la
-- reserva web y "Nuevo turno" (11:00, 11:45, 12:30… con 45; 11:00, 11:30… con 30).
-- Hasta ahora estaba fijo en 60. La DURACIÓN de cada turno sigue siendo la
-- del servicio (Ajustes → Servicios): esto sólo define la grilla.
-- ─────────────────────────────────────────────────────────────────────────
alter table shop_settings
  add column slot_step_min smallint not null default 60 check (slot_step_min in (30, 45, 60));
