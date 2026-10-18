import styles from "./Button.module.css";

export default function Button({ children, type = "button", variant = "primary", ...props }) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
