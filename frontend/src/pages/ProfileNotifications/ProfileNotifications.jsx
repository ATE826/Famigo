import Card from "../../components/Card/Card";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Switch from "../../components/Switch/Switch";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import styles from "./ProfileNotifications.module.css";

const kinds = [
  { key: "budget" },
  { key: "calendar" },
  { key: "fridge" },
  { key: "chat" },
  { key: "family" },
];

function ProfileNotifications() {
  const { notificationSettings, setNotificationSetting } = useData();

  return (
    <Page>
      <PageHeader title={t("nav.notifications")} to="/settings" />
      <p className={styles.intro}>{t("notifySettings.intro")}</p>

      <Card flush>
        {kinds.map((k) => (
          <label key={k.key} className={styles.row}>
            <span className={styles.text}>
              <span className={styles.title}>{t(`notifySettings.${k.key}.label`)}</span>
              <span className={styles.hint}>{t(`notifySettings.${k.key}.hint`)}</span>
            </span>
            <Switch
              checked={notificationSettings[k.key]}
              onChange={(e) => setNotificationSetting(k.key, e.target.checked)}
            />
          </label>
        ))}
      </Card>
    </Page>
  );
}

export default ProfileNotifications;
