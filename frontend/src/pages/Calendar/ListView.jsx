import EventCard from "./EventCard";
import { TODAY, dateKey, dayTitle, eventsInMonth, weekdayIndex, weekdaysFull } from "./data";
import { t } from "../../i18n";
import styles from "./Calendar.module.css";

export default function ListView({ selected, extra }) {
  const monthEvents = eventsInMonth(selected, extra);
  const keys = [...new Set(monthEvents.map((event) => event.date))].sort();

  if (keys.length === 0) {
    return <p className={styles.empty}>{t("calendar.noEventsMonth")}</p>;
  }

  return (
    <>
      {keys.map((key) => {
        const [year, month, day] = key.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return (
          <section key={key} className={styles.events}>
            <h2 className={styles.eventsTitle}>
              {weekdaysFull()[weekdayIndex(date)]}, {dayTitle(date)}
              {key === dateKey(TODAY) && <span className={styles.badge}>{t("calendar.today")}</span>}
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
