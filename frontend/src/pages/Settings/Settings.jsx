import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import MenuRow from "../../components/MenuRow/MenuRow";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Segmented from "../../components/Segmented/Segmented";
import { useData } from "../../store/DataContext";
import { useTheme } from "../../store/ThemeContext";
import { LANGUAGES, t } from "../../i18n";
import { useLanguage } from "../../i18n/LanguageContext";
import Switch from "../../components/Switch/Switch";
import useGeoSharing from "../../hooks/useGeoSharing";
import styles from "./Settings.module.css";

const themes = [
  { value: "light" },
  { value: "dark" },
  { value: "system" },
];

const NOTIFICATION_KINDS = 5;

function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { lang } = useLanguage();
  const { notificationSettings, plan } = useData();
  const geo = useGeoSharing();
  const [confirm, setConfirm] = useState(null);

  const enabledCount = Object.values(notificationSettings).filter(Boolean).length;
  const notice = location.state?.notice;

  return (
    <Page className={styles.page}>
      <PageHeader title={t("nav.settings")} to="/more" />

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings.appearance")}</h2>
        <Card className={styles.appearance}>
          <span className={styles.label}>{t("settings.theme")}</span>
          <Segmented
            options={themes.map((o) => ({ value: o.value, label: t(`settings.themes.${o.value}`) }))}
            value={theme}
            onChange={setTheme}
            label={t("settings.theme")}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("nav.premium")}</h2>
        <Card flush>
          <MenuRow
            to="/premium"
            icon="crown"
            label={t("nav.premium")}
            sub={t("premium.currentPlan", { plan: t(`premium.plans.${plan.id}.name`) })}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings.language")}</h2>
        <Card flush>
          <MenuRow
            to="/settings/language"
            icon="globe"
            label={t("settings.language")}
            sub={LANGUAGES.find((l) => l.value === lang)?.label}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("nav.notifications")}</h2>
        <Card flush>
          <MenuRow
            to="/settings/notifications"
            icon="bell"
            label={t("nav.notifications")}
            sub={t("settings.enabledOf", { count: enabledCount, total: NOTIFICATION_KINDS })}
          />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings.privacy")}</h2>
        <Card className={styles.shareCard}>
          <label className={styles.shareRow}>
            <span className={styles.shareText}>
              <span className={styles.label}>{t("map.share")}</span>
              <span className={styles.shareHint}>{t("map.shareHint")}</span>
            </span>
            <Switch checked={geo.on} onChange={(e) => geo.request(e.target.checked)} />
          </label>
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings.documents")}</h2>
        <Card flush>
          <MenuRow to="/legal/terms" icon="edit" label={t("legal.docs.terms")} />
          <MenuRow to="/legal/privacy" icon="lock" label={t("legal.docs.privacy")} />
          <MenuRow to="/legal/consent" icon="user" label={t("legal.docs.consent")} />
          <MenuRow to="/legal/geo" icon="pin" label={t("legal.docs.geo")} />
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("settings.security")}</h2>
        <Card flush>
          <MenuRow to="/settings/password" icon="lock" label={t("settings.changePassword")} />
          <MenuRow icon="logout" label={t("settings.logoutAll")} onClick={() => setConfirm("logout")} />
          <MenuRow icon="trash" label={t("settings.deleteAccount")} danger onClick={() => setConfirm("delete")} />
        </Card>

        {confirm && (
          <div className={styles.confirm} role="alert">
            <p className={styles.confirmText}>
              {confirm === "logout"
                ? t("settings.logoutAllConfirm")
                : t("settings.deleteConfirm")}
            </p>
            <div className={styles.confirmButtons}>
              <button type="button" className={styles.cancel} onClick={() => setConfirm(null)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={styles.confirmAction}
                onClick={() => navigate("/", { replace: true })}
              >
                {confirm === "logout" ? t("more.logout") : t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </section>
      {geo.dialog}
    </Page>
  );
}

export default Settings;
