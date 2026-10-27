-- Продукты в холодильнике конкретного дома.
-- Категории и единицы — коды, а не русские слова: переводит фронтенд.
-- «Заканчивается» и «испорчено» не хранятся, а считаются по quantity и expires_on.

CREATE TABLE products (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    home_id    UUID NOT NULL REFERENCES homes (id) ON DELETE CASCADE,
    name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
    category   TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('dairy', 'vegetables', 'meat', 'drinks', 'other')),
    -- NUMERIC, а не float: 0,3 кг должно оставаться ровно 0,3.
    quantity   NUMERIC(10, 3) NOT NULL CHECK (quantity > 0),
    unit       TEXT NOT NULL CHECK (unit IN ('pcs', 'ml', 'l', 'g', 'kg')),
    expires_on DATE NOT NULL,
    added_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Частый запрос: продукты дома, отсортированные по сроку годности.
CREATE INDEX products_home_expires_idx ON products (home_id, expires_on);
