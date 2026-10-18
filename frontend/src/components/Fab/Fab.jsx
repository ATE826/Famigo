import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import styles from "./Fab.module.css";

export default function Fab({ to, label, text }) {
  return (
    <Link to={to} aria-label={label} className={`${styles.fab} ${text ? styles.wide : ""}`}>
      <Icon name="plus" size={text ? 20 : 24} />
      {text}
    </Link>
  );
}
