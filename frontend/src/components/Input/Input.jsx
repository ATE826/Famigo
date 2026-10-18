import styles from "./Input.module.css";

// label — подпись над полем, action — необязательный элемент справа от подписи
// (например, ссылка «Забыли пароль?»). Остальные props уходят прямо в <input>.
export default function Input({ id, label, action, hint, ...props }) {
  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {action}
      </div>
      <input id={id} className={styles.input} {...props} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
