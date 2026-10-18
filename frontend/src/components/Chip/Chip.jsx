import { Link } from "react-router-dom";
import styles from "./Chip.module.css";

export default function Chip({ active = false, to, children, ...props }) {
  const className = `${styles.chip} ${active ? styles.active : ""}`;
  if (to) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  );
}

export function ChipRow({ children }) {
  return <div className={styles.row}>{children}</div>;
}
