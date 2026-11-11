import styles from "./Checkbox.module.css";

export default function Checkbox({ children, error, ...props }) {
  return (
    <div className={styles.wrap}>
      <label className={styles.row}>
        <input type="checkbox" className={styles.input} {...props} />
        <span className={`${styles.box} ${error ? styles.boxError : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={styles.tick}>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <span className={styles.text}>{children}</span>
      </label>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
