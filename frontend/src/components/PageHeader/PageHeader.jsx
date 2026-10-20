import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../Icon/Icon";
import styles from "./PageHeader.module.css";
import { t } from "../../i18n";

export default function PageHeader({ title, subtitle, to, icon = "back", right }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleBack(e) {
    if (location.key !== "default") {
      e.preventDefault();
      navigate(-1);
    }
  }

  return (
    <header className={styles.header}>
      {to && (
        <Link
          to={to}
          onClick={handleBack}
          className={styles.back}
          aria-label={icon === "close" ? t("common.close") : t("common.back")}
        >
          <Icon name={icon === "close" ? "close" : "back"} />
        </Link>
      )}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {right}
    </header>
  );
}
