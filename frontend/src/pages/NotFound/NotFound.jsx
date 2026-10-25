import { useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/Button/Button";
import { t } from "../../i18n";
import styles from "./NotFound.module.css";

function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = location.key !== "default";

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <svg className={styles.art} viewBox="0 0 600 420" role="img" aria-label={t("notFound.title")}>
          <circle className={styles.sun} cx="455" cy="110" r="52" />
          <path className={styles.hill} d="M0 300 Q150 210 300 280 T600 260 V420 H0Z" />
          <path className={styles.ground} d="M0 350 Q200 300 400 345 T600 330 V420 H0Z" />
          <rect className={styles.wall} x="160" y="225" width="130" height="95" rx="6" />
          <path className={styles.roof} d="M146 230 L225 166 L304 230Z" />
          <rect className={styles.roof} x="212" y="268" width="28" height="52" rx="4" />
          <path className={styles.post} d="M410 340 V230" />
          <rect className={styles.sign} x="360" y="214" width="100" height="44" rx="8" />
          <text className={styles.signText} x="410" y="244" textAnchor="middle">
            404
          </text>
        </svg>

        <h1 className={styles.title}>{t("notFound.title")}</h1>
        <p className={styles.text}>{t("notFound.text")}</p>

        <div className={styles.actions}>
          <Button onClick={() => navigate("/main", { replace: true })}>{t("notFound.home")}</Button>
          {canGoBack && (
            <Button variant="soft" onClick={() => navigate(-1)}>
              {t("common.back")}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

export default NotFound;
