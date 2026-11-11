import { t, tValue } from "../../i18n";
import { todayStart } from "../../utils/dates";

export const categories = ["Молочные", "Овощи", "Мясо", "Напитки", "Другое"];

export const units = ["шт.", "мл", "л", "кг", "г"];

export const categoryLabel = (value) => tValue("productCategories", value);
export const unitLabel = (value) => tValue("units", value);

const WARN_DAYS = 3;

export function unitStep(unit) {
  return unit === "мл" || unit === "г" ? 100 : 1;
}

function daysLeft(expires) {
  const [day, month, year] = expires.split(".").map(Number);
  return Math.round((new Date(year, month - 1, day) - todayStart()) / 86400000);
}

export function isSpoiled(product) {
  return daysLeft(product.expires) < 0;
}

const LOW_LIMITS = { "шт.": 3, "мл": 300, "г": 300, "л": 0.3, "кг": 0.3 };

export function isLow(product) {
  const limit = LOW_LIMITS[product.unit] ?? 1;
  return product.qty < limit && !isSpoiled(product);
}

export function needsAttention(product) {
  return isSpoiled(product) || isLow(product);
}

export function statusOf(product) {
  if (isSpoiled(product)) return "spoiled";
  if (daysLeft(product.expires) <= WARN_DAYS) return "warn";
  return "ok";
}

export function expiryDate(product) {
  const [day, month, year] = product.expires.split(".");
  return t("fridge.until", { date: `${day}.${month}.${year.slice(-2)}` });
}

export function productBadge(product) {
  if (isSpoiled(product)) return { tone: "spoiled", text: t("fridge.spoiled") };
  if (isLow(product)) return { tone: "warn", text: t("fridge.low") };
  if (statusOf(product) === "warn") return { tone: "warn", text: expiryDate(product) };
  return { tone: "ok", text: expiryDate(product) };
}
