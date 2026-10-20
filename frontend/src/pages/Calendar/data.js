import { todayStart } from "../../utils/dates";

export const TODAY = todayStart();

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WEEKDAYS_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

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
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function dayTitle(date) {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

export function weekLabel(date) {
  const start = weekStart(date);
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]}`;
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

const eventAt = (offset) => dateKey(addDays(TODAY, offset));

export const events = [
  { id: 1, date: eventAt(-21), time: "11:00", title: "Техосмотр" },
  { id: 2, date: eventAt(-12), time: "10:30", title: "Визит к врачу" },
  { id: 3, date: eventAt(-5), time: "15:00", title: "Встреча с друзьями" },
  { id: 4, date: eventAt(0), time: "19:00", title: "Семейный ужин" },
  { id: 5, date: eventAt(0), time: "21:00", title: "Фильм" },
  { id: 6, date: eventAt(3), time: "12:00", title: "Поездка на дачу" },
  { id: 7, date: eventAt(7), time: "09:00", title: "Оплата квартплаты" },
  { id: 8, date: eventAt(12), time: "18:30", title: "Родительское собрание" },
  { id: 9, date: eventAt(20), time: "09:00", title: "Визит к стоматологу" },
  { id: 10, date: eventAt(30), time: "10:00", title: "Поездка на дачу" },
];

export function eventsOn(date, extra = []) {
  const key = dateKey(date);
  return [...extra, ...events].filter((event) => event.date === key);
}

export function eventsInMonth(date, extra = []) {
  const prefix = dateKey(date).slice(0, 7);
  return [...extra, ...events].filter((event) => event.date.startsWith(prefix));
}

export function birthdayEvents(members, year) {
  return members
    .filter((m) => m.birthday)
    .map((m) => {
      const [day, month] = m.birthday.split(".");
      return {
        id: `bday-${m.id}-${year}`,
        date: `${year}-${month}-${day}`,
        time: "Весь день",
        title: `День рождения: ${m.name}`,
        allDay: true,
      };
    });
}
