import { useState } from "react";
import { digitsOnly } from "../../utils/validation";
import { t } from "../../i18n";
import Icon from "../Icon/Icon";
import styles from "./Input.module.css";

export default function Input({
  id,
  label,
  action,
  hint,
  inputClassName = "",
  numeric = false,
  type = "text",
  onChange,
  onKeyDown,
  ...props
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";
  const visibilityLabel = `${t(passwordVisible ? "auth.hidePassword" : "auth.showPassword")}${typeof label === "string" ? `: ${label}` : ""}`;
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
      <div className={styles.control}>
      <input
        id={id}
        className={`${styles.input} ${isPassword ? styles.passwordInput : ""} ${inputClassName}`}
        {...(numeric ? { inputMode: "numeric", autoComplete: "off" } : {})}
        {...props}
        type={isPassword && passwordVisible ? "text" : type}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />
      {isPassword && <button
        type="button"
        className={styles.visibility}
        disabled={props.disabled}
        aria-label={visibilityLabel}
        title={visibilityLabel}
        aria-pressed={passwordVisible}
        aria-controls={id}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setPasswordVisible((visible) => !visible)}
      >
        <Icon name={passwordVisible ? "eye" : "eyeOff"} size={20} strokeWidth={1.8} />
      </button>}
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
