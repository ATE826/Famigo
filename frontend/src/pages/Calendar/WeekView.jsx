import EventCard from "./EventCard";
import {
  TODAY,
  addDays,
  dayTitle,
  eventsOn,
  sameDay,
  weekStart,
  weekdayIndex,
  weekdays,
  weekdaysFull,
} from "./data";
import { t } from "../../i18n";
import styles from "./Calendar.module.css";

export default function WeekView({ selected, onSelect, extra }) {
  const start = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const withEvents = days.filter((day) => eventsOn(day, extra).length > 0);

  return (
    <>
      <div className={styles.weekStrip}>
        {days.map((day, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.weekDayButton} ${sameDay(day, selected) ? styles.weekDayActive : ""}`}
            aria-label={dayTitle(day)}
            aria-pressed={sameDay(day, selected)}
            onClick={() => onSelect(day)}
          >
            <span className={styles.weekDayName}>{weekdays()[i]}</span>
            <span className={`${styles.weekDayNum} ${sameDay(day, TODAY) ? styles.weekToday : ""}`}>
              {day.getDate()}
            </span>
            <span className={`${styles.dot} ${eventsOn(day, extra).length ? styles.hasEvent : ""}`} />
          </button>
        ))}
      </div>

      {withEvents.length === 0 && <p className={styles.empty}>{t("calendar.noEventsWeek")}</p>}

      {withEvents.map((day) => (
        <section key={day.getTime()} className={styles.events}>
          <h2 className={styles.eventsTitle}>
            {weekdaysFull()[weekdayIndex(day)]}, {dayTitle(day)}
            {sameDay(day, TODAY) && <span className={styles.badge}>{t("calendar.today")}</span>}
          </h2>
          {eventsOn(day, extra).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      ))}
    </>
  );
}
