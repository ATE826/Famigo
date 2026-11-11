import { useEffect, useState } from "react";
import Checkbox from "../Checkbox/Checkbox";
import Icon from "../Icon/Icon";
import LinkedText from "../LinkedText/LinkedText";
import { t } from "../../i18n";
import LegalLink from "../LegalModal/LegalLink";
import styles from "./GeoConsentDialog.module.css";

export default function GeoConsentDialog({ onConfirm, onCancel }) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="geo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.icon}>
          <Icon name="pin" size={24} strokeWidth={1.8} />
        </span>
        <h2 id="geo-title" className={styles.title}>
          {t("geo.title")}
        </h2>
        <p className={styles.text}>{t("geo.text")}</p>

        <Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)}>
          <LinkedText
            template={t("geo.agree")}
            links={{
              consent: <LegalLink doc="geo">{t("legal.linkGeo")}</LegalLink>,
            }}
          />
        </Checkbox>

        <div className={styles.buttons}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button type="button" className={styles.confirm} disabled={!agreed} onClick={onConfirm}>
            {t("geo.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
