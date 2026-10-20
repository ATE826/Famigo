import styles from "./Calendar.module.css";

export default function EventCard({ event }) {
  return (
    <div className={styles.event}>
      <span className={`${styles.eventLine} ${event.allDay ? styles.eventLineBirthday : ""}`} />
      <div className={styles.eventText}>
        <span className={styles.eventTime}>{event.time}</span>
        <span className={styles.eventTitle}>{event.title}</span>
      </div>
    </div>
  );
}
