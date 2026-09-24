-- ─────────────────────────────────────────────────────────────────────────
-- Virex — 0003: lo que marcó el revisor de seguridad de Supabase
-- ─────────────────────────────────────────────────────────────────────────

-- btree_gist (la del anti doble turno) fuera del esquema público. La
-- restricción EXCLUDE apunta al operador por id interno: sigue andando.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;

-- Las funciones de permisos no tienen por qué poder llamarse sin sesión.
-- `authenticated` las conserva: las políticas RLS las usan con el rol de
-- quien consulta. (webhook_events sin políticas es a propósito: sólo el
-- servidor escribe ahí.)
revoke execute on function is_member() from public, anon;
revoke execute on function is_owner() from public, anon;
