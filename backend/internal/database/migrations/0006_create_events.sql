-- События семейного календаря.
-- Дни рождения не хранятся: они вычисляются из users.birthday.

CREATE TABLE events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    created_by  UUID REFERENCES users (id) ON DELETE SET NULL,
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
    description TEXT CHECK (char_length(description) <= 200),
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ,
    place       TEXT CHECK (place IN ('apartment', 'dacha', 'cafe', 'restaurant', 'other')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT events_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Календарь всегда показывает события семьи за период (месяц, неделю, день).
CREATE INDEX events_family_starts_idx ON events (family_id, starts_at);

-- Кто участвует в событии.
CREATE TABLE event_members (
    event_id UUID NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX event_members_user_idx ON event_members (user_id);
