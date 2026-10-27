import { t } from "../i18n";

// Клиент API. Access-токен хранится только в памяти (не в localStorage):
// если на страницу проберётся чужой скрипт, достать токен из хранилища он не сможет.
// Долгий refresh-токен лежит в httpOnly-куке, которую видит только браузер.

const BASE = "/api";

let accessToken = null;
let refreshing = null;
let onSessionLost = () => {};

export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function setAccessToken(token) {
  accessToken = token;
}

// Вызывается, когда сессию восстановить не удалось (refresh-токен истёк или отозван).
export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

async function parse(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error ?? {};
    throw new ApiError(response.status, error.code ?? "http_error", error.message ?? t("errors.generic"), error.fields ?? {});
  }
  return data;
}

async function send(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network", t("errors.network"));
  }
  return parse(response);
}

// refreshSession получает новый access-токен по куке. Несколько одновременных вызовов
// объединяются в один запрос: иначе ротация токена сломала бы параллельные запросы.
export function refreshSession() {
  if (!refreshing) {
    refreshing = send("/auth/refresh", { method: "POST" })
      .then((session) => {
        setAccessToken(session.accessToken);
        return session;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// api — обычный запрос. Если access-токен истёк (401), один раз обновляем его и повторяем.
// Сессия считается потерянной, только если сервер явно отказал в обновлении (401).
// Нет сети или «слишком много запросов» — это не повод выкидывать человека из аккаунта.
export async function api(path, options) {
  try {
    return await send(path, options);
  } catch (error) {
    if (error.status !== 401 || path.startsWith("/auth/")) throw error;
    try {
      await refreshSession();
    } catch (refreshError) {
      if (refreshError.status === 401) {
        setAccessToken(null);
        onSessionLost();
        throw error;
      }
      throw refreshError;
    }
    return send(path, options);
  }
}

// Текст ошибки для человека: по известным кодам — на языке интерфейса,
// иначе — сообщение сервера.
const KNOWN = {
  network: "errors.network",
  too_many_requests: "errors.tooMany",
  email_taken: "errors.emailTaken",
  invalid_invite: "errors.invalidInvite",
  already_member: "errors.alreadyMember",
  plan_limit: "errors.planLimit",
  wrong_password: "errors.wrongPassword",
  last_home: "errors.lastHome",
  forbidden: "errors.forbidden",
  internal: "errors.generic",
};

export function errorText(error) {
  if (error?.status === 401 && error?.code === "unauthorized" && error.message) {
    return error.message;
  }
  const key = KNOWN[error?.code];
  return key ? t(key) : (error?.message ?? t("errors.generic"));
}
