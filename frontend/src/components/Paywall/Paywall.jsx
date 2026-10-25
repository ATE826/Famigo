import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import styles from "./Paywall.module.css";

// Заглушка платной функции: одна и та же на всех экранах
export default function Paywall({ title, text, cta, reason }) {
  return (
    <section className={styles.card}>
      <span className={styles.icon}>
        <Icon name="crown" size={24} strokeWidth={1.8} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      <Link to="/premium" state={{ reason }} className={styles.cta}>
        {cta}
      </Link>
    </section>
  );
}
