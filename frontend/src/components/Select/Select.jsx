import styles from "../Input/Input.module.css";

export default function Select({ id, label, children, ...props }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} className={styles.input} {...props}>
        {children}
      </select>
    </div>
  );
}
