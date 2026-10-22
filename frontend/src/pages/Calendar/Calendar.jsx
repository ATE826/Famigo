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
  weekdaysFull,
} from "./data";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import styles from "./Calendar.module.css";

const views = [
  { value: "month", label: "month" },
  { value: "week", label: "week" },
  { value: "day", label: "day" },
  { value: "list", label: "list" },
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
  if (view === "day") return `${dayTitle(date)}, ${weekdaysFull()[weekdayIndex(date)].toLowerCase()}`;
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
    <Page fab wide {...swipe}>
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        right={
          <button
            type="button"
            className={styles.todayButton}
            disabled={sameDay(selected, TODAY)}
            onClick={goToday}
          >
            {t("calendar.today")}
          </button>
        }
      />

      <div className={styles.toolbar}>
        <div className={styles.segment}>
          <Segmented
            size="sm"
            options={views.map((v) => ({ value: v.value, label: t(`calendar.views.${v.label}`) }))}
            value={view}
            onChange={changeView}
            label={t("calendar.viewLabel")}
          />
        </div>

        <div className={styles.nav}>
          <button type="button" className={styles.navButton} aria-label={t("common.back")} onClick={() => go(-1)}>
            <Icon name="back" size={20} />
          </button>
          <span className={styles.navLabel} aria-live="polite">
            {periodLabel(view, selected)}
          </span>
          <button type="button" className={styles.navButton} aria-label={t("common.forward")} onClick={() => go(1)}>
            <Icon name="chevron" size={20} />
          </button>
        </div>
      </div>

      <div
        key={`${view}-${periodKey(view, selected)}`}
        className={`${styles.view} ${styles[direction]}`}
      >
        <View selected={selected} onSelect={setSelected} extra={extra} />
      </div>

      <Fab to="/calendar/create" label={t("calendar.create")} />
    </Page>
  );
}

export default Calendar;
