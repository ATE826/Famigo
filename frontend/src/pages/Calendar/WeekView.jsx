import EventCard from "./EventCard";
import {
  TODAY,
  WEEKDAYS,
  WEEKDAYS_FULL,
  addDays,
  dayTitle,
  eventsOn,
  sameDay,
  weekStart,
  weekdayIndex,
} from "./data";
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
            <span className={styles.weekDayName}>{WEEKDAYS[i]}</span>
            <span className={`${styles.weekDayNum} ${sameDay(day, TODAY) ? styles.weekToday : ""}`}>
              {day.getDate()}
            </span>
            <span className={`${styles.dot} ${eventsOn(day, extra).length ? styles.hasEvent : ""}`} />
          </button>
        ))}
      </div>

      {withEvents.length === 0 && <p className={styles.empty}>На этой неделе событий нет</p>}

      {withEvents.map((day) => (
        <section key={day.getTime()} className={styles.events}>
          <h2 className={styles.eventsTitle}>
            {WEEKDAYS_FULL[weekdayIndex(day)]}, {dayTitle(day)}
            {sameDay(day, TODAY) && <span className={styles.badge}>Сегодня</span>}
          </h2>
          {eventsOn(day, extra).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </section>
      ))}
    </>
  );
}
