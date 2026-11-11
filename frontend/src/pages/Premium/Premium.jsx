import { useState } from "react";
import CheckoutDialog from "../../components/Checkout/CheckoutDialog";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import { getLocale, t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { formatMoney } from "../../utils/budget";
import { PLANS, PLAN_ORDER, yearSavingPercent } from "../../utils/plans";
import { formatBytes } from "../../utils/storage";
import { canManageHomes } from "../../utils/permissions";
import styles from "./Premium.module.css";

function featuresOf(planId) {
  const plan = PLANS[planId];
  const homes = Number.isFinite(plan.homes)
    ? t("premium.feat.homes", { count: plan.homes })
    : t("premium.feat.homesMany", { count: PLANS.premium.homes + 1 });
  const features = [
    { text: t("premium.feat.base"), on: true },
    { text: homes, on: true },
    { text: t("premium.feat.storage", { size: formatBytes(plan.storage) }), on: true },
    { text: plan.geo ? t("premium.feat.geo") : t("premium.feat.noGeo"), on: plan.geo },
  ];
  if (plan.geo) {
    features.push({ text: t("premium.feat.places", { count: plan.historyDays }), on: true });
  }
  features.push({ text: plan.geo ? t("premium.feat.sosMap") : t("premium.feat.sos"), on: true });
  if (plan.receipts) features.push({ text: t("premium.feat.receipts"), on: true });
  if (plan.recipes) features.push({ text: t("premium.feat.recipes"), on: true });
  if (plan.checkin) features.push({ text: t("premium.feat.checkin"), on: true });
  if (planId === "premiumPlus") features.push({ text: t("premium.feat.soon"), on: true, soon: true });
  return features;
}

function Premium() {
  const { subscription, plan, subscribe, setAutoRenew, members, currentUserId } = useData();
  const [period, setPeriod] = useState(subscription.period);
  const [checkout, setCheckout] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const payer = members.find((m) => m.id === subscription.payerId);
  const me = members.find((m) => m.id === currentUserId);
  const canManage = subscription.payerId === currentUserId || canManageHomes(me);
  const dateFormat = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long", year: "numeric" });

  const periods = [
    { value: "month", label: t("premium.billing.month") },
    { value: "year", label: t("premium.billing.year") },
  ];

  return (
    <Page wide>
      <PageHeader title={t("premium.title")} subtitle={t("premium.subtitle")} to="/settings" />

      <div className={styles.toggle}>
        <Segmented options={periods} value={period} onChange={setPeriod} label={t("premium.billing.label")} />
        <span className={styles.saving}>{t("premium.save", { percent: yearSavingPercent("premium") })}</span>
      </div>

      <div className={styles.grid}>
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = plan.id === id;
          const sameChoice = isCurrent && (id === "free" || subscription.period === period);
          const price = p.price[period];
          return (
            <section
              key={id}
              className={`${styles.card} ${id === "premium" ? styles.popular : ""} ${isCurrent ? styles.current : ""}`}
              aria-labelledby={`plan-${id}`}
            >
              <div className={styles.badges}>
                {id === "premium" && <span className={styles.badgePopular}>{t("premium.popular")}</span>}
                {isCurrent && <span className={styles.badgeCurrent}>{t("premium.current")}</span>}
              </div>
              <h2 id={`plan-${id}`} className={styles.name}>
                {t(`premium.plans.${id}.name`)}
              </h2>
              <p className={styles.tagline}>{t(`premium.plans.${id}.tagline`)}</p>

              <div className={styles.price}>
                {id === "free" ? (
                  <span className={styles.amount}>{t("premium.free")}</span>
                ) : (
                  <>
                    <span className={styles.amount}>{formatMoney(price)}</span>
                    <span className={styles.per}>{t(period === "year" ? "premium.perYear" : "premium.perMonth")}</span>
                  </>
                )}
              </div>

              <ul className={styles.features}>
                {featuresOf(id).map((f) => (
                  <li key={f.text} className={`${styles.feature} ${f.on ? "" : styles.off} ${f.soon ? styles.soon : ""}`}>
                    <Icon name={f.on ? "check" : "close"} size={16} strokeWidth={2.2} />
                    {f.text}
                  </li>
                ))}
              </ul>

              {id !== "free" && (
                <button
                  type="button"
                  className={styles.cta}
                  disabled={sameChoice}
                  onClick={() => setCheckout({ planId: id, period })}
                >
                  {sameChoice ? t("premium.currentButton") : t("premium.choose")}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {subscription.planId !== "free" && plan.id !== "free" && (
        <section className={styles.manage}>
          <h2 className={styles.manageTitle}>{t("premium.manage.title")}</h2>
          <dl className={styles.manageList}>
            <div>
              <dt>{t("premium.manage.plan")}</dt>
              <dd>
                {t(`premium.plans.${plan.id}.name`)} ·{" "}
                {t(subscription.period === "year" ? "premium.billing.year" : "premium.billing.month")}
              </dd>
            </div>
            <div>
              <dt>{subscription.cancelAtPeriodEnd ? t("premium.manage.endsLabel") : t("premium.manage.renewsLabel")}</dt>
              <dd>{dateFormat.format(new Date(subscription.renewsAt))}</dd>
            </div>
            {payer && (
              <div>
                <dt>{t("premium.manage.payerLabel")}</dt>
                <dd>{payer.name}</dd>
              </div>
            )}
          </dl>
          {subscription.cancelAtPeriodEnd ? (
            <p className={styles.cancelled} role="status">
              {t("premium.manage.cancelledNote", { date: dateFormat.format(new Date(subscription.renewsAt)) })}
            </p>
          ) : (
            <p className={styles.manageNote}>{t("premium.manage.note")}</p>
          )}
          {canManage &&
            (subscription.cancelAtPeriodEnd ? (
              <button type="button" className={styles.secondary} onClick={() => setAutoRenew(true)}>
                {t("premium.manage.resume")}
              </button>
            ) : (
              <button type="button" className={styles.cancelButton} onClick={() => setCancelling(true)}>
                {t("premium.manage.cancel")}
              </button>
            ))}
        </section>
      )}

      {cancelling && (
        <ConfirmDialog
          title={t("premium.cancelDialog.title")}
          text={t("premium.cancelDialog.text", {
            plan: t(`premium.plans.${plan.id}.name`),
            date: dateFormat.format(new Date(subscription.renewsAt)),
          })}
          cancelLabel={t("premium.cancelDialog.keep")}
          confirmLabel={t("premium.cancelDialog.confirm")}
          onConfirm={() => {
            setAutoRenew(false);
            setCancelling(false);
          }}
          onClose={() => setCancelling(false)}
        />
      )}

      {checkout && (
        <CheckoutDialog
          planId={checkout.planId}
          period={checkout.period}
          onConfirm={() => subscribe(checkout.planId, checkout.period)}
          onClose={() => setCheckout(null)}
        />
      )}
    </Page>
  );
}

export default Premium;
