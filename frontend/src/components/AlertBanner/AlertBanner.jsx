import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import { getLocale, t } from "../../i18n";
import { useData } from "../../store/DataContext";
import styles from "./AlertBanner.module.css";

const timeOf = (iso) => new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });

// Сигналы SOS: всплывают поверх любой страницы и не сдвигают вёрстку
export default function AlertBanner() {
  const { alerts, members, currentUserId, seeSos, resolveSos } = useData();
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? "";

  const mine = alerts.find((a) => a.from === currentUserId && !a.resolved);
  const incoming = alerts.filter((a) => a.from !== currentUserId && !a.resolved && !a.seenBy.includes(currentUserId));

  if (!mine && incoming.length === 0) return null;

  return (
    <div className={styles.stack} role="alert">
      {incoming.map((alert) => (
        <div key={alert.id} className={styles.item}>
          <span className={styles.icon}>
            <Icon name="alert" size={20} strokeWidth={2} />
          </span>
          <p className={styles.text}>
            <b>{t("safety.banner.from", { name: nameOf(alert.from) })}</b>
            <span>
              {alert.place ? t(`map.places.${alert.place}`) : t("safety.sos.unknownPlace")} · {timeOf(alert.at)}
            </span>
          </p>
          <div className={styles.buttons}>
            <button type="button" className={styles.ghost} onClick={() => seeSos(alert.id)}>
              {t("safety.banner.ack")}
            </button>
            <Link to="/map" className={styles.solid} onClick={() => seeSos(alert.id)}>
              {t("safety.banner.openMap")}
            </Link>
          </div>
        </div>
      ))}

      {mine && (
        <div className={styles.item}>
          <span className={styles.icon}>
            <Icon name="alert" size={20} strokeWidth={2} />
          </span>
          <p className={styles.text}>
            <b>{t("safety.banner.mineTitle")}</b>
            <span>{t("safety.banner.mineText", { time: timeOf(mine.at) })}</span>
          </p>
          <div className={styles.buttons}>
            <button type="button" className={styles.solid} onClick={() => resolveSos(mine.id)}>
              {t("safety.banner.cancelSos")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
