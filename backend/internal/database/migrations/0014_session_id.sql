-- Номер сессии входа. Он общий для всех refresh-токенов одной сессии (при обновлении
-- токен меняется, а сессия остаётся) и записывается в access-токен (claim «sid»).
--
-- Зачем: раньше access-токен жил свои 15 минут, даже если человек вышел или сменил пароль.
-- Теперь сервер на каждый запрос проверяет, что сессия токена ещё не завершена,
-- поэтому после выхода токен перестаёт работать сразу.
ALTER TABLE refresh_tokens ADD COLUMN session_id UUID;

-- У уже существующих токенов сессией считаем их собственный id.
UPDATE refresh_tokens SET session_id = id;

ALTER TABLE refresh_tokens ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX refresh_tokens_session_idx ON refresh_tokens (session_id);
