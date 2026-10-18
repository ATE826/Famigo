import styles from "./FormScreen.module.css";

export default function FormScreen({ onSubmit, children, footer, className = "" }) {
  return (
    <form className={styles.screen} onSubmit={onSubmit} noValidate>
      <div className={`${styles.body} ${className}`}>{children}</div>
      <div className={styles.footer}>{footer}</div>
    </form>
  );
}
