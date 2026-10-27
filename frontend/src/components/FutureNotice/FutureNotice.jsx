import Icon from "../Icon/Icon";
import { t } from "../../i18n";
import styles from "./FutureNotice.module.css";

// Плашка для разделов, которых нет в MVP: показывает, что здесь демо-данные
export default function FutureNotice({ className = "" }) {
  return (
    <p className={`${styles.notice} ${className}`} role="note">
      <span className={styles.icon}>
        <Icon name="clock" size={18} strokeWidth={1.8} />
      </span>
      <span className={styles.text}>
        <b>{t("future.title")}</b>
        <span>{t("future.text")}</span>
      </span>
    </p>
  );
}
