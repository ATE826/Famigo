import Icon from "../Icon/Icon";
import styles from "./MonthSwitcher.module.css";
import { t } from "../../i18n";

export default function MonthSwitcher({ label, onPrev, onNext, prevDisabled = false, nextDisabled = false }) {
  return (
    <div className={styles.nav}>
      <button
        type="button"
        className={styles.button}
        aria-label={t("common.prevMonth")}
        disabled={prevDisabled}
        onClick={onPrev}
      >
        <Icon name="back" size={20} />
      </button>
      <span className={styles.label} aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className={styles.button}
        aria-label={t("common.nextMonth")}
        disabled={nextDisabled}
        onClick={onNext}
      >
        <Icon name="chevron" size={20} />
      </button>
    </div>
  );
}
