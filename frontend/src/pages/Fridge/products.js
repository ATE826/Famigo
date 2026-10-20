import { todayStart } from "../../utils/dates";

export const categories = ["Молочные", "Овощи", "Мясо", "Напитки", "Другое"];

export const units = ["шт.", "мл", "л", "кг", "г"];

const WARN_DAYS = 3;

export function unitStep(unit) {
  return unit === "мл" || unit === "г" ? 100 : 1;
}

function daysLeft(expires) {
  const [day, month, year] = expires.split(".").map(Number);
  return Math.round((new Date(year, month - 1, day) - todayStart()) / 86400000);
}

export function isSpoiled(product) {
  return Boolean(product.spoiled) || daysLeft(product.expires) < 0;
}

export function isLow(product) {
  return Boolean(product.low) && !isSpoiled(product);
}

export function needsAttention(product) {
  return isSpoiled(product) || isLow(product);
}

export function statusOf(product) {
  if (isSpoiled(product)) return "spoiled";
  if (daysLeft(product.expires) <= WARN_DAYS) return "warn";
  return "ok";
}

export function expiryLabel(product) {
  if (isSpoiled(product)) return "Испорчено";
  const [day, month, year] = product.expires.split(".");
  return `до ${day}.${month}.${year.slice(-2)}`;
}
