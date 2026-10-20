import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import styles from "./MenuRow.module.css";

export default function MenuRow({ to, onClick, icon, label, sub, danger = false }) {
  const content = (
    <>
      <span className={`${styles.icon} ${danger ? styles.iconDanger : ""}`}>
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <span className={styles.text}>
        <span className={`${styles.label} ${danger ? styles.labelDanger : ""}`}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {to && <Icon name="chevron" size={18} className={styles.chevron} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={styles.row}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={styles.row} onClick={onClick}>
      {content}
    </button>
  );
}
