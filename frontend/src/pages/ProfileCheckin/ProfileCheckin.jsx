import Card from "../../components/Card/Card";
import Paywall from "../../components/Paywall/Paywall";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import Switch from "../../components/Switch/Switch";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import styles from "./ProfileCheckin.module.css";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "18:00", "20:00"];

function ProfileCheckin() {
  const { members, currentUserId, updateMember, plan } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const settings = me?.checkin ?? { enabled: false, time: "11:00" };

  function change(patch) {
    updateMember(currentUserId, { checkin: { ...settings, ...patch } });
  }

  return (
    <Page>
      <PageHeader title={t("safety.checkin.title")} to="/profile" />
      <p className={styles.intro}>{t("safety.checkin.hint")}</p>

      {!plan.checkin ? (
        <Paywall
          title={t("safety.checkin.lockedTitle")}
          text={t("safety.checkin.lockedText")}
          cta={t("safety.checkin.lockedCta")}
          reason="checkin"
        />
      ) : (
        <Card flush>
          <label className={styles.row}>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{t("safety.checkin.enable")}</span>
            </span>
            <Switch checked={settings.enabled} onChange={(e) => change({ enabled: e.target.checked })} />
          </label>
          {settings.enabled && (
            <div className={styles.select}>
              <Select
                id="checkin-time"
                label={t("safety.checkin.time")}
                value={settings.time}
                onChange={(e) => change({ time: e.target.value })}
              >
                {TIMES.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}

export default ProfileCheckin;
