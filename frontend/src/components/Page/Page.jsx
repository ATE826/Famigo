import styles from "./Page.module.css";

export default function Page({ children, className = "", fab = false }) {
  return (
    <main className={`${styles.page} ${fab ? styles.fab : ""} ${className}`}>
      {children}
    </main>
  );
}
