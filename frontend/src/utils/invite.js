import { t } from "../i18n";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
export const INVITE_HOURS = 12;

export function invitePeriod(now = new Date()) {
  const start = new Date(now);
  start.setHours(now.getHours() < INVITE_HOURS ? 0 : INVITE_HOURS, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + INVITE_HOURS);
  return { start, end };
}

export function inviteCode(seed, now = new Date()) {
  const text = `${seed}:${invitePeriod(now).start.getTime()}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[hash % ALPHABET.length];
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
  }
  return code;
}

export function timeLeftLabel(now = new Date()) {
  const minutes = Math.max(1, Math.ceil((invitePeriod(now).end - now) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return t("time.minutes", { count: rest });
  return rest === 0 ? t("time.hours", { count: hours }) : t("time.hoursMinutes", { hours, minutes: rest });
}
