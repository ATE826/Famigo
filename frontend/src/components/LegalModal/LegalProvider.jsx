import { useEffect, useState } from "react";
import LegalDocument from "../LegalDocument/LegalDocument";
import Icon from "../Icon/Icon";
import { documents } from "../../legal/documents";
import { t } from "../../i18n";
import { LegalContext } from "./LegalContext";
import styles from "./LegalModal.module.css";

export default function LegalProvider({ children }) {
  const [docId, setDocId] = useState(null);
  const document = docId ? documents[docId] : null;

  useEffect(() => {
    if (!docId) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setDocId(null);
      }
    }
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [docId]);

  return (
    <LegalContext.Provider value={{ open: setDocId }}>
      {children}
      {document && (
        <div className={styles.overlay} onClick={() => setDocId(null)}>
          <div
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={document.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.head}>
              <h2 className={styles.title}>{document.title}</h2>
              <button type="button" className={styles.close} aria-label={t("common.close")} onClick={() => setDocId(null)}>
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className={styles.body}>
              <LegalDocument id={docId} showTitle={false} />
            </div>
            <div className={styles.foot}>
              <button type="button" className={styles.done} onClick={() => setDocId(null)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </LegalContext.Provider>
  );
}
