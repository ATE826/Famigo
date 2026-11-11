import { t } from "../i18n";

// Код приглашения выдаёт сервер, он действует 12 часов.
export const INVITE_HOURS = 12;

// Сколько осталось до конца действия кода: «3 ч 20 мин».
export function timeLeftUntil(expiresAt, now = new Date()) {
  const minutes = Math.max(1, Math.ceil((new Date(expiresAt) - now) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t("time.minutes", { count: rest });
  return rest === 0 ? t("time.hours", { count: hours }) : t("time.hoursMinutes", { hours, minutes: rest });
}
