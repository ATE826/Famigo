-- Доходы и расходы семьи.
-- Остаток не хранится: это opening_balance семьи плюс сумма всех операций.
-- Так он никогда не разойдётся с историей.

CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID NOT NULL REFERENCES families (id) ON DELETE CASCADE,
    -- Кто добавил. Если человек удалит аккаунт, операция в истории семьи останется.
    user_id     UUID REFERENCES users (id) ON DELETE SET NULL,
    home_id     UUID REFERENCES homes (id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category    TEXT NOT NULL,
    title       TEXT CHECK (char_length(title) <= 20),
    description TEXT CHECK (char_length(description) <= 100),
    -- Сумма в копейках, всегда положительная; знак задаёт type.
    amount      BIGINT NOT NULL CHECK (amount > 0),
    occurred_on DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Категория должна подходить к типу: «Зарплата» не бывает расходом.
    CONSTRAINT transactions_category_matches_type CHECK (
        (type = 'expense' AND category IN ('groceries', 'home', 'transport', 'entertainment', 'other'))
        OR (type = 'income' AND category IN ('salary', 'gift', 'other'))
    ),
    -- Для «Другое» название обязательно, как в форме на фронтенде.
    CONSTRAINT transactions_other_has_title CHECK (category <> 'other' OR title IS NOT NULL)
);

-- История операций семьи от новых к старым и выборка по месяцу.
CREATE INDEX transactions_family_date_idx ON transactions (family_id, occurred_on DESC);
