import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import { useData } from "../../store/DataContext";
import { canManageHomes } from "../../utils/permissions";
import { t } from "../../i18n";
import styles from "./NoHomes.module.css";

// Пустое состояние для разделов, которым нужен дом (сейчас — холодильник).
// Дома создают владелец и администраторы, остальным подсказываем, к кому обратиться.
export default function NoHomes() {
  const { members, currentUserId } = useData();
  const canManage = canManageHomes(members.find((m) => m.id === currentUserId));

  return (
    <section className={styles.box}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="home" size={40} strokeWidth={1.4} />
      </span>
      <h2 className={styles.title}>{t("fridge.noHomesTitle")}</h2>
      <p className={styles.text}>{t("fridge.noHomesText")}</p>
      {canManage ? (
        <Link to="/more/homes/add" className={styles.action}>
          {t("fridge.noHomesAction")}
        </Link>
      ) : (
        <p className={styles.ask}>{t("fridge.noHomesAsk")}</p>
      )}
    </section>
  );
}
