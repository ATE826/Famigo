import useSos from "../../hooks/useSos";
import { t } from "../../i18n";
import styles from "./SosButton.module.css";

export default function SosButton({ className = "" }) {
  const sos = useSos();
  return (
    <>
      <button type="button" className={`${styles.button} ${className}`} aria-label={t("safety.sos.aria")} onClick={sos.request}>
        SOS
      </button>
      {sos.dialog}
    </>
  );
}
