import { Link, Navigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import { plural } from "../../utils/plural";
import { roleLabels } from "../../utils/roles";
import styles from "./ChatInfo.module.css";

function ChatInfo() {
  const { id } = useParams();
  const { members, chatSettings, setChatSetting } = useData();

  if (id !== GROUP_CHAT_ID) {
    return <Navigate to={`/more/family/${id}`} replace />;
  }

  const settings = chatSettings[id];
  const count = `${members.length} ${plural(members.length, ["участник", "участника", "участников"])}`;

  return (
    <Page>
      <PageHeader title="О чате" to={`/chats/${id}`} />

      <div className={styles.top}>
        <Avatar letter="С" size={96} />
        <h2 className={styles.name}>Семья</h2>
        <span className={styles.count}>{count}</span>
        <a href="#" className={styles.photo}>
          Сменить фото
        </a>
      </div>

      <Card flush>
        <label className={styles.setting}>
          <span className={styles.settingText}>
            <span className={styles.settingTitle}>Уведомления</span>
            <span className={styles.settingHint}>Сообщения из этого чата</span>
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
            <span className={styles.settingTitle}>Закрепить чат</span>
            <span className={styles.settingHint}>Показывать вверху списка</span>
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
        <h3 className={styles.membersTitle}>Участники: {members.length}</h3>
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
