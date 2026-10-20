import { Link, Navigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import { roleLabels } from "../../utils/roles";
import { t } from "../../i18n";
import styles from "./ChatInfo.module.css";

function ChatInfo() {
  const { id } = useParams();
  const { members, chatSettings, setChatSetting } = useData();

  if (id !== GROUP_CHAT_ID) {
    return <Navigate to={`/more/family/${id}`} replace />;
  }

  const settings = chatSettings[id];
  const count = t("plural.members", { count: members.length });
  const name = t("chats.family");

  return (
    <Page>
      <PageHeader title={t("chats.about")} to={`/chats/${id}`} />

      <div className={styles.top}>
        <Avatar letter={name[0]} size={96} />
        <h2 className={styles.name}>{name}</h2>
        <span className={styles.count}>{count}</span>
        <a href="#" className={styles.photo}>
          {t("profile.changePhoto")}
        </a>
      </div>

      <Card flush>
        <label className={styles.setting}>
          <span className={styles.settingText}>
            <span className={styles.settingTitle}>{t("nav.notifications")}</span>
            <span className={styles.settingHint}>{t("chats.notifyHint")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={!settings.muted}
            onChange={(e) => setChatSetting(id, "muted", !e.target.checked)}
          />
        </label>
        <label className={styles.setting}>
          <span className={styles.settingText}>
            <span className={styles.settingTitle}>{t("chats.pin")}</span>
            <span className={styles.settingHint}>{t("chats.pinHint")}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.switch}
            checked={settings.pinned}
            onChange={(e) => setChatSetting(id, "pinned", e.target.checked)}
          />
        </label>
      </Card>

      <Card flush>
        <h3 className={styles.membersTitle}>{t("chats.membersCount", { count: members.length })}</h3>
        {members.map((m) => (
          <Link key={m.id} to={`/more/family/${m.id}`} className={styles.member}>
            <Avatar letter={m.letter} tone={m.tone} photo={m.photo} size={44} />
            <div className={styles.memberText}>
              <span className={styles.memberName}>{m.name}</span>
              <span className={styles.memberRole}>{roleLabels[m.role]}</span>
            </div>
            <Icon name="chevron" size={18} className={styles.chevron} />
          </Link>
        ))}
      </Card>
    </Page>
  );
}

export default ChatInfo;
