export function isEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function emailError(value) {
  if (!value.trim()) return "Введите email";
  if (!isEmail(value)) return "Некорректный email";
  return "";
}

export function amountError(value) {
  if (!value.trim()) return "Введите сумму";
  const number = Number(value.replace(/[\s₽]/g, "").replace(",", "."));
  if (Number.isNaN(number)) return "Введите число";
  if (number <= 0) return "Сумма должна быть больше нуля";
  return "";
}

export function quantityError(value) {
  if (!value.trim()) return "Введите количество";
  const number = Number(value.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(number)) return "Введите число";
  if (number <= 0) return "Количество должно быть больше нуля";
  return "";
}

export function countError(value, min, max) {
  if (!value.trim()) return "Введите число";
  if (!/^\d+$/.test(value.trim())) return "Введите целое число";
  const number = Number(value);
  if (number < min || number > max) return `Число от ${min} до ${max}`;
  return "";
}

export function formatDate(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  let result = digits.slice(0, 2);
  if (digits.length > 2) result += "." + digits.slice(2, 4);
  if (digits.length > 4) result += "." + digits.slice(4);
  return result;
}

export function dateError(value) {
  if (!value.trim()) return "Введите дату";
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return "Формат: ДД.ММ.ГГГГ";
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? "" : "Такой даты не существует";
}

export function formatTime(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? digits.slice(0, 2) + ":" + digits.slice(2) : digits;
}

export function timeError(value) {
  if (!value.trim()) return "Введите время";
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return "Формат: ЧЧ:ММ";
  const [, hours, minutes] = match.map(Number);
  return hours <= 23 && minutes <= 59 ? "" : "Такого времени не существует";
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
  if (digits.length !== 11 || !["7", "8"].includes(digits[0])) return "Некорректный номер телефона";
  return "";
}
