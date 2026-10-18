import styles from "./Segmented.module.css";

export default function Segmented({ options, value, onChange, size = "md", label }) {
  const activeIndex = Math.max(
    options.findIndex((opt) => opt.value === value),
    0,
  );

  return (
    <div
      className={`${styles.box} ${styles[size]}`}
      style={{ "--i": activeIndex, "--n": options.length }}
      role="group"
      aria-label={label}
    >
      <span className={styles.indicator} aria-hidden="true" />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.item} ${opt.value === value ? styles.active : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
