import Card from "../../components/Card/Card";
import EventCard from "./EventCard";
import { TODAY, WEEKDAYS, dayTitle, eventsOn, monthCells, sameDay } from "./data";
import styles from "./Calendar.module.css";

export default function MonthView({ selected, onSelect, extra }) {
  const cells = monthCells(selected);
  const dayEvents = eventsOn(selected, extra);

  return (
    <>
      <Card className={styles.calendar}>
        <div className={styles.grid}>
          {WEEKDAYS.map((d) => (
            <div key={d} className={styles.weekDay}>
              {d}
            </div>
          ))}
          {cells.map((date, i) =>
            date ? (
              <button
                key={i}
                type="button"
                className={styles.cell}
                aria-label={dayTitle(date)}
                aria-pressed={sameDay(date, selected)}
                onClick={() => onSelect(date)}
              >
                <span
                  className={`${styles.num} ${sameDay(date, TODAY) ? styles.today : ""} ${
                    sameDay(date, selected) ? styles.selected : ""
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className={`${styles.dot} ${eventsOn(date, extra).length ? styles.hasEvent : ""}`} />
              </button>
            ) : (
              <div key={i} className={styles.cell} />
            ),
          )}
        </div>
      </Card>

      <section className={styles.events}>
        <h2 className={styles.eventsTitle}>
          {sameDay(selected, TODAY) && "Сегодня, "}
          {dayTitle(selected)}
        </h2>
        {dayEvents.length === 0 && <p className={styles.empty}>Событий нет</p>}
        {dayEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </section>
    </>
  );
}
