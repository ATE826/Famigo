import { t } from "../i18n";
import { todayStart } from "./dates";

export function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function emailError(value) {
  if (!value.trim()) return t("validation.emailRequired");
  if (!isEmail(value)) return t("validation.emailInvalid");
  return "";
}

export function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

export function amountError(value) {
  if (!value.trim()) return t("validation.amountRequired");
  const number = Number(value.replace(/[\s₽]/g, "").replace(",", "."));
  if (Number.isNaN(number)) return t("validation.number");
  if (number <= 0) return t("validation.amountPositive");
  return "";
}

export function quantityError(value) {
  if (!value.trim()) return t("validation.quantityRequired");
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(number)) return t("validation.number");
  if (number <= 0) return t("validation.quantityPositive");
  return "";
}

export function countError(value, min, max) {
  if (!value.trim()) return t("validation.number");
  if (!/^\d+$/.test(value.trim())) return t("validation.integer");
  const number = Number(value);
  if (number < min || number > max) return t("validation.range", { min, max });
  return "";
}

export function formatDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let result = digits.slice(0, 2);
  if (digits.length > 2) result += "." + digits.slice(2, 4);
  if (digits.length > 4) result += "." + digits.slice(4);
  return result;
}

export function formatShortDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  let result = digits.slice(0, 2);
  if (digits.length > 2) result += "." + digits.slice(2, 4);
  if (digits.length > 4) result += "." + digits.slice(4);
  return result;
}

export function shortDateError(value) {
  if (!value.trim()) return t("validation.dateRequired");
  const match = /^(\d{2})\.(\d{2})\.(\d{2})$/.exec(value.trim());
  if (!match) return t("validation.shortDateFormat");
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = 2000 + Number(match[3]);
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? "" : t("validation.dateInvalid");
}

export function dateError(value) {
  if (!value.trim()) return t("validation.dateRequired");
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return t("validation.dateFormat");
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? "" : t("validation.dateInvalid");
}

export function formatTime(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
}

export function timeError(value) {
  if (!value.trim()) return t("validation.timeRequired");
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return t("validation.timeFormat");
  const [, hours, minutes] = match.map(Number);
  return hours <= 23 && minutes <= 59 ? "" : t("validation.timeInvalid");
}

export function formatPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits[0] === "8") digits = "7" + digits.slice(1);
  else if (digits[0] !== "7") digits = "7" + digits;
  digits = digits.slice(0, 11);
  let result = "+7";
  if (digits.length > 1) result += "(" + digits.slice(1, 4);
  if (digits.length > 4) result += ")" + digits.slice(4, 7);
  if (digits.length > 7) result += "-" + digits.slice(7, 9);
  if (digits.length > 9) result += "-" + digits.slice(9, 11);
  return result;
}

export function phoneError(value) {
  if (!value.trim()) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11 || !["7", "8"].includes(digits[0])) return t("validation.phoneInvalid");
  return "";
}

export function birthdayError(value) {
  if (!value.trim()) return "";
  const error = dateError(value);
  if (error) return error;
  const [day, month, year] = value.split(".").map(Number);
  return new Date(year, month - 1, day) > todayStart() ? t("validation.dateFuture") : "";
}
