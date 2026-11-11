import { useEffect } from "react";
import Icon from "../Icon/Icon";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import styles from "./Toast.module.css";

const VISIBLE_MS = 4000;

// Всплывающее сообщение об ошибке для действий, которые не ждут ответа сервера
// (отметить задачу, изменить количество продукта и т. п.).
export default function Toast() {
  const { toast, dismissToast } = useData();

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(dismissToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div className={styles.toast} role="alert" key={toast.id}>
      <Icon name="alert" size={18} strokeWidth={1.8} />
      <span className={styles.text}>{toast.text}</span>
      <button type="button" className={styles.close} aria-label={t("common.close")} onClick={dismissToast}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
