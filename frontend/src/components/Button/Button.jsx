import styles from "./Button.module.css";

// variant: "primary" (зелёная, по умолчанию) или "soft" (светлая)
export default function Button({ children, type = "button", variant = "primary", ...props }) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
