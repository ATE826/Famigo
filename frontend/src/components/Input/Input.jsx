import { digitsOnly } from "../../utils/validation";
import styles from "./Input.module.css";

export default function Input({
  id,
  label,
  action,
  hint,
  inputClassName = "",
  numeric = false,
  onChange,
  onKeyDown,
  ...props
}) {
  function handleKeyDown(e) {
    onKeyDown?.(e);
    if (!numeric || e.defaultPrevented) return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable && !/\d/.test(e.key)) e.preventDefault();
  }

  function handleChange(e) {
    if (numeric) e.target.value = digitsOnly(e.target.value);
    onChange?.(e);
  }

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {action}
      </div>
      <input
        id={id}
        className={`${styles.input} ${inputClassName}`}
        {...(numeric ? { inputMode: "numeric", autoComplete: "off" } : {})}
        {...props}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
