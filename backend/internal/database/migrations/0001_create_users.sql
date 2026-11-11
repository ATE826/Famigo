-- Аккаунты и всё, что принадлежит лично человеку (а не семье).

-- Пользователь. id — UUID, а не 1, 2, 3: по ссылке нельзя перебрать чужие аккаунты.
-- Пароль не хранится, только его bcrypt-хеш.
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL CHECK (char_length(email) <= 254),
    email_verified_at TIMESTAMPTZ,
    password_hash     TEXT NOT NULL,
    name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
    birthday          DATE,
    phone             TEXT CHECK (phone ~ '^\+[0-9]{10,15}$'),
    phone_verified_at TIMESTAMPTZ,
    avatar_url        TEXT,
    avatar_tone       TEXT NOT NULL DEFAULT 'green'
                      CHECK (avatar_tone IN ('green', 'terra', 'mint', 'cream', 'graphite')),
    food_note         TEXT CHECK (char_length(food_note) <= 60),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Почта уникальна без учёта регистра: Anton@Mail.ru и anton@mail.ru — один человек.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Предпочтения в еде: одна строка на один пункт («Без глютена», «Аллергия на орехи»
-- или свой пункт). Составной ключ не даёт добавить один пункт дважды.
CREATE TABLE user_food_prefs (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value   TEXT NOT NULL CHECK (char_length(value) BETWEEN 1 AND 40),
    PRIMARY KEY (user_id, value)
);

-- Личные настройки: какие уведомления присылать и язык.
CREATE TABLE user_settings (
    user_id         UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    notify_budget   BOOLEAN NOT NULL DEFAULT true,
    notify_calendar BOOLEAN NOT NULL DEFAULT true,
    notify_fridge   BOOLEAN NOT NULL DEFAULT true,
    notify_chat     BOOLEAN NOT NULL DEFAULT true,
    notify_family   BOOLEAN NOT NULL DEFAULT true,
    language        TEXT NOT NULL DEFAULT 'ru'
                    CHECK (language IN ('ru', 'en', 'es', 'zh', 'ja', 'de'))
);

-- Согласия по 152-ФЗ: на какой документ, какой версии и когда согласился человек.
-- Отзыв согласия — это отметка revoked_at, а не удаление строки: история нужна по закону.
CREATE TABLE consents (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    document   TEXT NOT NULL CHECK (document IN ('terms', 'privacy', 'data', 'food', 'geo')),
    version    TEXT NOT NULL,
    given_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX consents_user_idx ON consents (user_id);

-- Сессии входа. Храним хеш refresh-токена: если базу украдут, токенами не воспользоваться.
CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Коды подтверждения почты и телефона и сброса пароля. Тоже только хеш.
-- attempts ограничивает подбор кода.
CREATE TABLE verification_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('email', 'phone', 'password_reset')),
    target     TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    attempts   SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ
);

CREATE INDEX verification_codes_user_idx ON verification_codes (user_id, purpose);
