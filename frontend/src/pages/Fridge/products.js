export const categories = ["Молочные", "Овощи", "Мясо", "Напитки", "Другое"];

export const units = ["шт.", "мл", "л", "кг", "г"];

const MOCK_TODAY = new Date(2026, 7, 17);
const WARN_DAYS = 4;

export function unitStep(unit) {
  return unit === "мл" || unit === "г" ? 100 : 1;
}

function daysLeft(expires) {
  const [day, month, year] = expires.split(".").map(Number);
  return Math.round((new Date(year, month - 1, day) - MOCK_TODAY) / 86400000);
}

export function isSpoiled(product) {
  return Boolean(product.spoiled) || daysLeft(product.expires) < 0;
}

export function statusOf(product) {
  if (isSpoiled(product)) return "spoiled";
  if (product.low || daysLeft(product.expires) <= WARN_DAYS) return "warn";
  return "ok";
}

export function expiryLabel(product) {
  if (isSpoiled(product)) return "Испорчено";
  if (product.low) return "Заканчивается";
  const [day, month, year] = product.expires.split(".");
  return `до ${day}.${month}.${year.slice(-2)}`;
}
