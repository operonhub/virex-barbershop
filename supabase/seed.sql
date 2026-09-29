-- ─────────────────────────────────────────────────────────────────────────
-- Virex — datos iniciales reales (24/09/2026)
--
-- Fuente: Santiago (cliente del local hace 10 años). Idempotente: se puede
-- correr de nuevo sin duplicar (usa ids fijos y ON CONFLICT).
-- Supuestos a confirmar: quién es el dueño en el sistema y las comisiones.
-- ─────────────────────────────────────────────────────────────────────────

insert into staff (id, name, role, commission_pct) values
  ('00000000-0000-4000-8000-000000000001', 'Santiago',  'dueno',   0),
  ('00000000-0000-4000-8000-000000000002', 'Sebastián', 'barbero', 50),
  ('00000000-0000-4000-8000-000000000003', 'Nehemías',  'barbero', 50)
on conflict (id) do update set name = excluded.name, role = excluded.role, commission_pct = excluded.commission_pct;

-- Todos los turnos duran una hora.
insert into services (id, name, category, duration_min, price, counts_for_loyalty, sort) values
  ('00000000-0000-4000-8000-000000000101', 'Corte',         'corte', 60, 15000, true, 1),
  ('00000000-0000-4000-8000-000000000102', 'Corte + barba', 'combo', 60, 20000, true, 2)
on conflict (id) do update set name = excluded.name, duration_min = excluded.duration_min, price = excluded.price;

-- Los tres trabajan de martes (2) a sábado (6), de 11 a 20.
delete from staff_schedules where staff_id in (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
insert into staff_schedules (staff_id, weekday, start_time, end_time)
select s.id, d.weekday, '11:00', '20:00'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid), ('00000000-0000-4000-8000-000000000003'::uuid)) as s (id)
cross join generate_series(2, 6) as d (weekday);

update agent_settings set
  name = 'Asistente Virex',
  tone = 'cercano',
  rules = array[
    'Nunca inventes descuentos ni promociones que no existen.',
    'Por ahora el local hace sólo corte y corte + barba. Si piden otra cosa (color, diseño, barba sola), decilo y derivá a Santiago.',
    'Si alguien se queja de un corte, pedí disculpas y derivá a una persona de inmediato.',
    'Por Instagram, pedí nombre y teléfono antes de confirmar un turno.'
  ],
  after_hours_note = 'Fuera de horario igual podés agendar, pero aclarás que el local atiende de martes a sábado de 11 a 20.',
  updated_at = now()
where id = 1;
