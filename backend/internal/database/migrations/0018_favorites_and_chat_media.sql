CREATE TABLE recipe_favorites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipe jsonb NOT NULL,
 fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, fingerprint)
);
ALTER TABLE messages ADD COLUMN details jsonb NOT NULL DEFAULT '{}';
CREATE TABLE chat_media (
 id uuid PRIMARY KEY,
 chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
 message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
 mime text NOT NULL,
 name text NOT NULL,
 data bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_media_message ON chat_media(message_id);
