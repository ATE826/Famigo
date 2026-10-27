import { useEffect, useState } from "react";
import Checkbox from "../Checkbox/Checkbox";
import FutureNotice from "../FutureNotice/FutureNotice";
import Icon from "../Icon/Icon";
import LegalLink from "../LegalModal/LegalLink";
import LinkedText from "../LinkedText/LinkedText";
import { t } from "../../i18n";
import { PLANS } from "../../utils/plans";
import { formatMoney } from "../../utils/budget";
import { errorText } from "../../api/client";
import styles from "./CheckoutDialog.module.css";

export default function CheckoutDialog({ planId, period, onConfirm, onClose }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const price = PLANS[planId].price[period];
  const planName = t(`premium.plans.${planId}.name`);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function pay() {
    if (!agreed) {
      setError(t("auth.agreeRequired"));
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.dialog} ${done ? styles.success : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <span className={styles.mark} aria-hidden="true">
              <svg viewBox="0 0 52 52" className={styles.markSvg}>
                <circle className={styles.markCircle} cx="26" cy="26" r="24" />
                <path className={styles.markTick} d="M15 27.5l8 8 14.5-17" />
              </svg>
            </span>
            <h2 id="checkout-title" className={styles.title}>
              {t("premium.checkout.success")}
            </h2>
            <p className={styles.text}>{t("premium.checkout.successText", { plan: planName })}</p>
            <button type="button" className={styles.doneButton} onClick={onClose}>
              {t("premium.checkout.done")}
            </button>
          </>
        ) : (
          <>
            <span className={styles.icon}>
              <Icon name="crown" size={24} strokeWidth={1.8} />
            </span>
            <h2 id="checkout-title" className={styles.title}>
              {t("premium.checkout.title")}
            </h2>

            <dl className={styles.summary}>
              <div className={styles.line}>
                <dt>{t("premium.checkout.plan")}</dt>
                <dd>{planName}</dd>
              </div>
              <div className={styles.line}>
                <dt>{t("premium.checkout.period")}</dt>
                <dd>{t(period === "year" ? "premium.checkout.periodYear" : "premium.checkout.periodMonth")}</dd>
              </div>
              <div className={`${styles.line} ${styles.total}`}>
                <dt>{t("premium.checkout.total")}</dt>
                <dd>{formatMoney(price)}</dd>
              </div>
            </dl>

            <FutureNotice />

            <p className={styles.note}>{t("premium.checkout.autoRenew")}</p>
            <p className={styles.demo}>{t("premium.checkout.demo")}</p>

            <Checkbox
              checked={agreed}
              error={error}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setError("");
              }}
            >
              <LinkedText
                template={t("premium.checkout.agree")}
                links={{ terms: <LegalLink doc="terms">{t("legal.linkTerms")}</LegalLink> }}
              />
            </Checkbox>

            <div className={styles.buttons}>
              <button type="button" className={styles.cancel} onClick={onClose}>
                {t("common.cancel")}
              </button>
              <button type="button" className={styles.primary} onClick={pay}>
                {t("premium.checkout.pay", { price: formatMoney(price) })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
