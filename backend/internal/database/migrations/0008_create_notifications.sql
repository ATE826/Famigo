-- Уведомления конкретному человеку. read_at пустой — уведомление не прочитано.

CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id  UUID REFERENCES families (id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('budget', 'calendar', 'fridge', 'chat', 'family')),
    title      TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    body       TEXT CHECK (char_length(body) <= 200),
    -- Куда перейти по нажатию, например /more/fridge.
    link       TEXT,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Лента уведомлений человека от новых к старым.
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);

-- Счётчик на колокольчике: в индекс попадают только непрочитанные, поэтому он маленький.
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
