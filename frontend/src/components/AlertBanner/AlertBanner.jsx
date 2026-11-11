import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import styles from "./AlertBanner.module.css";

const VISIBLE_MS = 8000;

function SosToast({ alert }) {
  const { members, currentUserId, seeSos } = useData();
  const [paused, setPaused] = useState(false);
  const mine = alert.from === currentUserId;
  const author = members.find((member) => member.id === alert.from)?.name ?? "";

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => seeSos(alert.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [alert.id, paused, seeSos]);

  return (
    <div className={styles.toast} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}>
      <span className={styles.icon} aria-hidden="true"><Icon name="alert" size={22} strokeWidth={2} /></span>
      <div className={styles.body}>
        <p className={styles.text} role="alert">{mine ? t("safety.banner.mineTitle") : t("safety.banner.from", { name: author })}</p>
        <Link to="/chats/family" className={styles.link} onClick={() => seeSos(alert.id)}>{t("safety.banner.openChat")}</Link>
      </div>
      <button type="button" className={styles.close} aria-label={t("common.close")} onClick={() => seeSos(alert.id)}>
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

// Прочитанные уведомления не повторяются при переходах между страницами.
export default function AlertBanner() {
  const { alerts, currentUserId } = useData();
  const next = alerts.filter((alert) => !alert.resolved && !alert.seenBy.includes(currentUserId)).at(-1);
  return next ? <SosToast key={next.id} alert={next} /> : null;
}
