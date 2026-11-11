import { getLang, getLocale, t } from "../../i18n";
import { todayStart } from "../../utils/dates";

export const TODAY = todayStart();

const MONDAY = new Date(2024, 0, 1);

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function format(date, options) {
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
}

export function weekdays() {
  if (getLang() === "ru") return t("weekdays.short");
  return Array.from({ length: 7 }, (_, i) => format(addDays(MONDAY, i), { weekday: "short" }));
}

export function weekdaysFull() {
  if (getLang() === "ru") return t("weekdays.full");
  return Array.from({ length: 7 }, (_, i) => capitalize(format(addDays(MONDAY, i), { weekday: "long" })));
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function addMonths(date, n) {
  const year = date.getFullYear();
  const month = date.getMonth() + n;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

export function sameDay(a, b) {
  return a.getTime() === b.getTime();
}

export function weekdayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export function weekStart(date) {
  return addDays(date, -weekdayIndex(date));
}

export function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthLabel(date) {
  if (getLang() === "ru") return `${t("months.nominative")[date.getMonth()]} ${date.getFullYear()}`;
  return capitalize(format(date, { month: "long", year: "numeric" }));
}

export function dayTitle(date) {
  if (getLang() === "ru") return `${date.getDate()} ${t("months.genitive")[date.getMonth()]}`;
  return format(date, { day: "numeric", month: "long" });
}

export function joinedLabel(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!match) return "";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  if (getLang() === "ru") return t("months.genitive")[date.getMonth()];
  return format(date, { month: "long", year: "numeric" });
}

export function weekLabel(date) {
  const start = weekStart(date);
  const end = addDays(start, 6);
  if (getLang() !== "ru") {
    return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "short" }).formatRange(start, end);
  }
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${t("months.genitive")[end.getMonth()]}`;
  }
  const short = t("months.shortGenitive");
  return `${start.getDate()} ${short[start.getMonth()]} – ${end.getDate()} ${short[end.getMonth()]}`;
}

export function monthCells(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const offset = weekdayIndex(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const count = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= daysInMonth ? new Date(year, month, day) : null;
  });
}

export function eventsOn(date, extra = []) {
  const key = dateKey(date);
  // Сначала события на весь день (дни рождения), затем по времени.
  return extra
    .filter((event) => event.date === key)
    .sort((x, y) => Number(Boolean(y.allDay)) - Number(Boolean(x.allDay)) || x.time.localeCompare(y.time));
}

export function eventsInMonth(date, extra = []) {
  const prefix = dateKey(date).slice(0, 7);
  return extra.filter((event) => event.date.startsWith(prefix));
}

export function birthdayEvents(members, year) {
  return members
    .filter((m) => m.birthday)
    .map((m) => {
      const [day, month] = m.birthday.split(".");
      return {
        id: `bday-${m.id}-${year}`,
        date: `${year}-${month}-${day}`,
        time: t("calendar.allDay"),
        title: t("calendar.birthdayOf", { name: m.name }),
        allDay: true,
      };
    });
}
