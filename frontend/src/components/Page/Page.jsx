import styles from "./Page.module.css";

export default function Page({ children, className = "", fab = false, ...rest }) {
  return (
    <main className={`${styles.page} ${fab ? styles.fab : ""} ${className}`} {...rest}>
      {children}
    </main>
  );
}
