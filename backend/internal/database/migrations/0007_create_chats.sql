-- Чаты: один общий чат семьи и личные чаты пар участников.

CREATE TABLE chats (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id  UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('family', 'direct')),
    -- Для личного чата: «меньший_id:больший_id». Так у пары всегда один и тот же ключ,
    -- и уникальный индекс не даст создать второй личный чат между теми же людьми.
    direct_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chats_direct_key_by_kind CHECK (
        (kind = 'family' AND direct_key IS NULL) OR (kind = 'direct' AND direct_key IS NOT NULL)
    ),
    UNIQUE (family_id, direct_key)
);

-- Общий чат у семьи ровно один.
CREATE UNIQUE INDEX chats_one_family_chat ON chats (family_id) WHERE kind = 'family';

-- Участники чата и их личные настройки. По last_read_at считаются непрочитанные
-- и отметка «прочитано» у отправителя.
CREATE TABLE chat_members (
    chat_id      UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    muted        BOOLEAN NOT NULL DEFAULT false,
    pinned       BOOLEAN NOT NULL DEFAULT false,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX chat_members_user_idx ON chat_members (user_id);

-- Сообщения. Удалённое сообщение помечается deleted_at и теряет текст, чтобы в чате
-- осталось «сообщение удалено», а не дыра в переписке, и сам текст нигде не хранился.
CREATE TABLE messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id    UUID NOT NULL REFERENCES chats (id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users (id) ON DELETE SET NULL,
    text       TEXT NOT NULL CHECK (char_length(text) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at  TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,

    -- Пустой текст допустим только у удалённого сообщения.
    CONSTRAINT messages_text_required CHECK (deleted_at IS NOT NULL OR char_length(text) >= 1)
);

-- Лента чата: последние сообщения первыми, подгрузка «ещё» по created_at.
CREATE INDEX messages_chat_created_idx ON messages (chat_id, created_at DESC);
