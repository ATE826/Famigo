import { useState } from "react";
import Fab from "../../components/Fab/Fab";
import useSwipe from "../../hooks/useSwipe";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";
import ListView from "./ListView";
import {
  TODAY,
  WEEKDAYS_FULL,
  addDays,
  addMonths,
  birthdayEvents,
  dateKey,
  dayTitle,
  monthLabel,
  sameDay,
  weekLabel,
  weekStart,
  weekdayIndex,
} from "./data";
import { useData } from "../../store/DataContext";
import styles from "./Calendar.module.css";

const views = [
  { value: "month", label: "Месяц" },
  { value: "week", label: "Неделя" },
  { value: "day", label: "День" },
  { value: "list", label: "Список" },
];

const viewComponents = {
  month: MonthView,
  week: WeekView,
  day: DayView,
  list: ListView,
};

function shift(view, date, direction) {
  if (view === "week") return addDays(date, 7 * direction);
  if (view === "day") return addDays(date, direction);
  return addMonths(date, direction);
}

function periodLabel(view, date) {
  if (view === "week") return weekLabel(date);
  if (view === "day") return `${dayTitle(date)}, ${WEEKDAYS_FULL[weekdayIndex(date)].toLowerCase()}`;
  return monthLabel(date);
}

function periodKey(view, date) {
  if (view === "week") return dateKey(weekStart(date));
  if (view === "day") return dateKey(date);
  return dateKey(date).slice(0, 7);
}

function Calendar() {
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(TODAY);
  const [direction, setDirection] = useState("fade");
  const View = viewComponents[view];
  const { members } = useData();
  const year = selected.getFullYear();
  const extra = [year - 1, year, year + 1].flatMap((y) => birthdayEvents(members, y));

  function go(step) {
    setDirection(step > 0 ? "next" : "prev");
    setSelected(shift(view, selected, step));
  }

  const swipe = useSwipe({ onLeft: () => go(1), onRight: () => go(-1) });

  function changeView(value) {
    setDirection("fade");
    setView(value);
  }

  function goToday() {
    setDirection("fade");
    setSelected(TODAY);
  }

  return (
    <Page fab {...swipe}>
      <PageHeader
        title="Календарь"
        subtitle="Общий календарь семьи"
        right={
          <button
            type="button"
            className={styles.todayButton}
            disabled={sameDay(selected, TODAY)}
            onClick={goToday}
          >
            Сегодня
          </button>
        }
      />

      <Segmented size="sm" options={views} value={view} onChange={changeView} label="Вид календаря" />

      <div className={styles.nav}>
        <button type="button" className={styles.navButton} aria-label="Назад" onClick={() => go(-1)}>
          <Icon name="back" size={20} />
        </button>
        <span className={styles.navLabel} aria-live="polite">
          {periodLabel(view, selected)}
        </span>
        <button type="button" className={styles.navButton} aria-label="Вперёд" onClick={() => go(1)}>
          <Icon name="chevron" size={20} />
        </button>
      </div>

      <div
        key={`${view}-${periodKey(view, selected)}`}
        className={`${styles.view} ${styles[direction]}`}
      >
        <View selected={selected} onSelect={setSelected} extra={extra} />
      </div>

      <Fab to="/calendar/create" label="Создать событие" />
    </Page>
  );
}

export default Calendar;
