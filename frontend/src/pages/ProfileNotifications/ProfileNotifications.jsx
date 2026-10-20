import Card from "../../components/Card/Card";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Switch from "../../components/Switch/Switch";
import { useData } from "../../store/DataContext";
import styles from "./ProfileNotifications.module.css";

const kinds = [
  { key: "budget", label: "Бюджет", hint: "Новые расходы и доходы" },
  { key: "calendar", label: "Календарь", hint: "События, напоминания и дни рождения" },
  { key: "fridge", label: "Холодильник", hint: "Продукты заканчиваются или портятся" },
  { key: "chat", label: "Чаты", hint: "Новые сообщения" },
  { key: "family", label: "Семья", hint: "Новые участники и приглашения" },
];

function ProfileNotifications() {
  const { notificationSettings, setNotificationSetting } = useData();

  return (
    <Page>
      <PageHeader title="Уведомления" to="/profile" />
      <p className={styles.intro}>Выберите, о чём присылать уведомления</p>

      <Card flush>
        {kinds.map((k) => (
          <label key={k.key} className={styles.row}>
            <span className={styles.text}>
              <span className={styles.title}>{k.label}</span>
              <span className={styles.hint}>{k.hint}</span>
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
