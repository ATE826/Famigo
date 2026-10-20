import { getLang, getLocale, t, tValue } from "../i18n";
import { OPENING_BALANCE } from "../store/operations";

export const CURRENT_MONTH = "2026-10";


const pad = (n) => String(n).padStart(2, "0");

export function monthInSentence(date) {
  if (getLang() === "ru") return t("months.prepositional")[date.getMonth()];
  const month = getLang() === "zh" ? "short" : "long";
  return new Intl.DateTimeFormat(getLocale(), { month }).format(date);
}

export function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseMonth(param) {
  const match = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return parseMonth(CURRENT_MONTH);
}

export function opsInMonth(operations, key) {
  return operations.filter((o) => o.date.startsWith(key));
}

export function totalOf(operations, type) {
  return operations.filter((o) => o.type === type).reduce((sum, o) => sum + o.amount, 0);
}

export function balanceUpTo(operations, key) {
  const net = operations
    .filter((o) => o.date.slice(0, 7) <= key)
    .reduce((sum, o) => sum + (o.type === "income" ? o.amount : -o.amount), 0);
  return OPENING_BALANCE + net;
}

export function earliestMonthKey(operations) {
  return operations.reduce((min, o) => (o.date.slice(0, 7) < min ? o.date.slice(0, 7) : min), CURRENT_MONTH);
}

function monthShort(date) {
  if (getLang() === "ru") return t("months.short")[date.getMonth()];
  return new Intl.DateTimeFormat(getLocale(), { month: "short" }).format(date);
}

export function monthlyTotals(operations, endKey, count) {
  const end = parseMonth(endKey);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1);
    const ops = opsInMonth(operations, monthKey(date));
    return {
      key: monthKey(date),
      label: monthShort(date),
      income: totalOf(ops, "income"),
      expense: totalOf(ops, "expense"),
    };
  });
}

export function byCategory(operations, type) {
  const totals = new Map();
  operations
    .filter((o) => o.type === type)
    .forEach((o) => totals.set(o.category, (totals.get(o.category) ?? 0) + o.amount));
  return [...totals]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export const categoryLabel = (name) => tValue("budgetCategories", name);

export function formatMoney(amount) {
  return `${new Intl.NumberFormat(getLocale()).format(amount)} ₽`;
}
