import styles from "./Input.module.css";

export default function Input({ id, label, action, hint, inputClassName = "", ...props }) {
  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {action}
      </div>
      <input id={id} className={`${styles.input} ${inputClassName}`} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
