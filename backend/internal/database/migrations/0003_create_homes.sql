-- Дома семьи и дела по дому.

CREATE TABLE homes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id    UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
    kind         TEXT NOT NULL DEFAULT 'apartment'
                 CHECK (kind IN ('apartment', 'house', 'dacha', 'other')),
    place        TEXT CHECK (char_length(place) <= 80),
    rooms        SMALLINT NOT NULL DEFAULT 1 CHECK (rooms BETWEEN 1 AND 99),
    people_count SMALLINT NOT NULL DEFAULT 0 CHECK (people_count BETWEEN 0 AND 30),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Нужен для составного внешнего ключа ниже.
    UNIQUE (family_id, id)
);

-- «Где сейчас живёт участник». Одна колонка, а не отдельная таблица: так база сама
-- гарантирует, что человек живёт только в одном доме семьи.
-- Составной ключ (family_id, home_id) не даст поселить человека в дом чужой семьи.
-- Удалили дом — у жильцов home_id станет NULL (нужен PostgreSQL 15+ для «SET NULL (колонка)»).
ALTER TABLE family_members
    ADD COLUMN home_id UUID,
    ADD CONSTRAINT family_members_home_fk
        FOREIGN KEY (family_id, home_id) REFERENCES homes (family_id, id)
        ON DELETE SET NULL (home_id);

CREATE INDEX homes_family_idx ON homes (family_id);

-- Дела по дому. done_at пустой — задача не выполнена; заполнен — когда её сделали.
CREATE TABLE home_tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id     UUID NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 60),
    description TEXT CHECK (char_length(description) <= 300),
    done_at     TIMESTAMPTZ,
    created_by  UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX home_tasks_home_idx ON home_tasks (home_id);
