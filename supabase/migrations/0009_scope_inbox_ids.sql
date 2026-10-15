-- Paso compatible con la versión actual: agregar las claves compuestas antes
-- de desplegar el código que las usa. La restricción global se retira en 0010.
alter table conversations
  add constraint conversations_account_conversation_unique unique (zernio_account_id, zernio_id);

alter table messages
  add constraint messages_conversation_message_unique unique (conversation_id, zernio_id);
