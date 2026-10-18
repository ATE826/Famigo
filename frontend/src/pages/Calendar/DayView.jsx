import EventCard from "./EventCard";
import { eventsOn } from "./data";
import styles from "./Calendar.module.css";

const hours = Array.from({ length: 16 }, (_, i) => i + 8);

export default function DayView({ selected }) {
  const dayEvents = eventsOn(selected);

  return (
    <>
      <div className={styles.timeline}>
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter((event) => parseInt(event.time, 10) === hour);
          return (
            <div key={hour} className={styles.hourRow}>
              <span className={styles.hourLabel}>{String(hour).padStart(2, "0")}:00</span>
              <div className={styles.hourSlot}>
                {hourEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {dayEvents.length === 0 && <p className={styles.empty}>В этот день событий нет</p>}
    </>
  );
}
