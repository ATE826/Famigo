-- Семья и её участники.

-- Деньги — в копейках (BIGINT): у дробных чисел бывают ошибки округления, у целых нет.
CREATE TABLE families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    timezone        TEXT NOT NULL DEFAULT 'Europe/Moscow',
    opening_balance BIGINT NOT NULL DEFAULT 0,
    created_by      UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Кто в какой семье и с какой ролью. Связь «многие ко многим»: один человек может
-- состоять в нескольких семьях, в семье много людей.
-- Колонка home_id («где сейчас живёт») добавляется в 0003, когда появится таблица homes.
CREATE TABLE family_members (
    family_id UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (family_id, user_id)
);

-- Владелец в семье ровно один: частичный уникальный индекс не даст сделать второго.
CREATE UNIQUE INDEX family_members_one_owner ON family_members (family_id) WHERE role = 'owner';

-- Быстрый поиск «в каких семьях состоит человек».
CREATE INDEX family_members_user_idx ON family_members (user_id);

-- Если владелец ушёл из семьи или удалил аккаунт, права переходят дальше:
-- первому по времени вступления администратору, а если админов нет — первому участнику.
-- Если в семье никого не осталось, семья удаляется.
-- Правило живёт в базе, поэтому срабатывает при любом способе удаления,
-- в том числе каскадом при удалении пользователя.
CREATE FUNCTION pass_family_ownership() RETURNS trigger AS $$
DECLARE
    heir UUID;
BEGIN
    IF OLD.role <> 'owner' THEN
        RETURN NULL;
    END IF;

    -- Семью удаляют целиком: передавать права некому и незачем.
    IF NOT EXISTS (SELECT 1 FROM families WHERE id = OLD.family_id) THEN
        RETURN NULL;
    END IF;

    SELECT user_id INTO heir
    FROM family_members
    WHERE family_id = OLD.family_id
    ORDER BY (role = 'admin') DESC, joined_at, user_id
    LIMIT 1;

    IF heir IS NULL THEN
        DELETE FROM families WHERE id = OLD.family_id;
    ELSE
        UPDATE family_members SET role = 'owner'
        WHERE family_id = OLD.family_id AND user_id = heir;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER family_owner_left
    AFTER DELETE ON family_members
    FOR EACH ROW EXECUTE FUNCTION pass_family_ownership();

-- Код приглашения: 5 символов без похожих (нет 0/O, 1/I), действует 12 часов.
CREATE TABLE family_invites (
    code       TEXT PRIMARY KEY CHECK (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
    family_id  UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX family_invites_family_idx ON family_invites (family_id, expires_at);
