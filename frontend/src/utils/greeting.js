import { t } from "../i18n";

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return t("greeting.morning");
  if (hour >= 12 && hour < 18) return t("greeting.day");
  if (hour >= 18 && hour < 23) return t("greeting.evening");
  return t("greeting.night");
}
