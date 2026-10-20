import styles from "./Page.module.css";

export default function Page({ children, className = "", fab = false, wide = false, ...rest }) {
  return (
    <main className={`${styles.page} ${fab ? styles.fab : ""} ${wide ? styles.wide : ""} ${className}`} {...rest}>
      {children}
    </main>
  );
}
