import EventCard from "./EventCard";
import { TODAY, WEEKDAYS_FULL, dateKey, dayTitle, eventsInMonth, weekdayIndex } from "./data";
import styles from "./Calendar.module.css";

export default function ListView({ selected }) {
  const monthEvents = eventsInMonth(selected);
  const keys = [...new Set(monthEvents.map((event) => event.date))].sort();

  if (keys.length === 0) {
    return <p className={styles.empty}>В этом месяце событий нет</p>;
  }

  return (
    <>
      {keys.map((key) => {
        const [year, month, day] = key.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return (
          <section key={key} className={styles.events}>
            <h2 className={styles.eventsTitle}>
              {WEEKDAYS_FULL[weekdayIndex(date)]}, {dayTitle(date)}
              {key === dateKey(TODAY) && <span className={styles.badge}>Сегодня</span>}
            </h2>
            {monthEvents
              .filter((event) => event.date === key)
              .map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
          </section>
        );
      })}
    </>
  );
}
