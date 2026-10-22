import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import LegalDocument from "../../components/LegalDocument/LegalDocument";
import { documentOrder, documents } from "../../legal/documents";
import { t } from "../../i18n";
import styles from "./Legal.module.css";

function Legal() {
  const { doc } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  if (!documents[doc]) {
    return <Navigate to="/legal/terms" replace />;
  }

  function goBack() {
    if (location.key !== "default" && window.history.length > 1) navigate(-1);
    else navigate("/");
  }

  return (
    <main className={styles.page}>
      <div className={styles.bar}>
        <button type="button" className={styles.back} onClick={goBack} aria-label={t("common.back")}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className={styles.brand}>Famigo</span>
      </div>

      <div className={styles.container}>
        <ChipRow aria-label={t("legal.title")}>
          {documentOrder.map((id) => (
            <Chip key={id} to={`/legal/${id}`} active={id === doc} replace>
              {t(`legal.docs.${id}`)}
            </Chip>
          ))}
        </ChipRow>

        <div className={styles.article}>
          <LegalDocument id={doc} />
        </div>
      </div>
    </main>
  );
}

export default Legal;
