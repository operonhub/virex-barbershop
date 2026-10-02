-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0008: vales y pagos a barberos (cierre semanal)
--
-- En el Excel de la barbería, los vales ("vale santi", "vale nemo") y el pago
-- semanal a Nehemías van a la hoja de gastos con el nombre en el detalle. Para
-- que el panel pueda cerrar la semana de cada uno (comisión + propinas − vales
-- − lo ya pagado), el gasto necesita saber de QUIÉN es.
--
--   staff_id   barbero al que corresponde el gasto. Sólo en vales y sueldos.
--   'vale'     adelanto de plata a un barbero o a un dueño (un retiro).
-- ─────────────────────────────────────────────────────────────────────────
alter table expenses
  add column staff_id uuid references staff (id);

alter table expenses drop constraint expenses_category_check;
alter table expenses add constraint expenses_category_check
  check (category in ('alquiler', 'servicios', 'insumos', 'sueldos', 'marketing', 'otros', 'vale'));

create index expenses_staff_idx on expenses (staff_id, paid_at) where staff_id is not null;
