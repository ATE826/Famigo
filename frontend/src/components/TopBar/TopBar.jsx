import { Link } from "react-router-dom";
import Avatar from "../Avatar/Avatar";
import Icon from "../Icon/Icon";
import SosButton from "../SosButton/SosButton";
import { useData } from "../../store/DataContext";
import { homeOf } from "../../utils/homes";
import styles from "./TopBar.module.css";
import { t } from "../../i18n";

export default function TopBar() {
  const { members, homes, currentUserId } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const myHome = homeOf(homes, currentUserId);

  return (
    <header className={styles.bar}>
      {myHome && (
        <Link to={`/more/home/${myHome.id}`} className={styles.home}>
          <Icon name="home" size={16} strokeWidth={1.8} />
          {t("common.nowAt", { name: myHome.name })}
        </Link>
      )}
      <SosButton />
      <Link to="/notifications" className={styles.bell} aria-label={t("nav.notifications")}>
        <Icon name="bell" size={20} strokeWidth={1.8} />
        <span className={styles.badge}>3</span>
      </Link>
      <Link to="/profile" className={styles.profile}>
        <Avatar letter={me?.letter ?? ""} tone={me?.tone} photo={me?.photo} size={40} />
        {me?.name}
      </Link>
    </header>
  );
}
