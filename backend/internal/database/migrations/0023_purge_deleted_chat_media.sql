-- Purge attachments left by the previous soft-delete implementation.
-- Forwarded media have their own rows and remain available.
DELETE FROM chat_media
WHERE EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = chat_media.message_id
      AND messages.deleted_at IS NOT NULL
);
