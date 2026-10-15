-- Aplicar después de desplegar una versión que ya usa las claves compuestas.
-- Zernio identifica cada conversación en el contexto de la cuenta; los ids
-- opacos pueden repetirse entre cuentas sin que deban compartir historial.
alter table conversations drop constraint conversations_zernio_id_key;
alter table messages drop constraint messages_zernio_id_key;
