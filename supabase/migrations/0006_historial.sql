-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0006: historial importado del Excel de la barbería
--
-- Antes de usar el panel llevaban la contabilidad en un Excel: por día y por
-- barbero, cuántos cortes y cuánta plata (efectivo y transferencia), más los
-- gastos. No hay turnos ni clientes detrás de esos números, así que se cargan
-- como cobros y gastos sueltos, marcados como `imported` para poder
-- distinguirlos (y volver a cargarlos si hay que corregir algo).
--
--   units     cuántos cortes representa la fila. Una fila importada es "el día X,
--             Sebastián, efectivo: 5 cortes, $45.000"; el ticket promedio y los
--             servicios por barbero se cuentan con esto, no con la cantidad de filas.
--   imported  true en lo que vino del Excel.
-- ─────────────────────────────────────────────────────────────────────────
alter table payments
  add column imported boolean not null default false,
  add column units    integer not null default 1 check (units >= 0);

alter table expenses
  add column imported boolean not null default false;

create index payments_imported_idx on payments (paid_at) where imported;
create index expenses_imported_idx on expenses (paid_at) where imported;
