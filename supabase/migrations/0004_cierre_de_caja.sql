-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0004: cierre de caja, uno por día
--
-- `business_day` es el día de trabajo (hora argentina) al que corresponde el
-- cierre. Único: si hay un error se corrige el cierre, no se agrega otro.
-- El efectivo esperado lo calcula el servidor; la pantalla sólo manda lo contado.
-- ─────────────────────────────────────────────────────────────────────────
alter table cash_sessions add column business_day date;
update cash_sessions set business_day = (opened_at at time zone 'America/Argentina/Buenos_Aires')::date where business_day is null;
alter table cash_sessions alter column business_day set not null;
create unique index cash_sessions_business_day_idx on cash_sessions (business_day);
