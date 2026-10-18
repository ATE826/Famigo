import styles from "./Card.module.css";

export default function Card({ children, className = "", flush = false, ...props }) {
  return (
    <div className={`${styles.card} ${flush ? styles.flush : ""} ${className}`} {...props}>
      {children}
    </div>
  );
}
