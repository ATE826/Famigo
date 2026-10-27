-- Подписка семьи: один платит — пользуется вся семья.
-- Нет строки — семья на тарифе Free.
-- Лимиты тарифов (число домов, хранилище, геолокация) живут в коде (subscriptions/plans.go),
-- а не в базе: их проще менять и они одинаковы для всех семей.

CREATE TABLE subscriptions (
    family_id            UUID PRIMARY KEY REFERENCES families (id) ON DELETE CASCADE,
    plan                 TEXT NOT NULL CHECK (plan IN ('free', 'premium', 'premium_plus')),
    period               TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month', 'year')),
    -- До какого момента оплачено. Если дата прошла, тариф считается Free.
    renews_at            TIMESTAMPTZ,
    -- Подписку отменили: она действует до renews_at и больше не продлевается.
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    payer_id             UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_paid_has_period_end CHECK (plan = 'free' OR renews_at IS NOT NULL)
);
