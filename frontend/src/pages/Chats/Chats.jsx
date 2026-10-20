import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Page from "../../components/Page/Page";
import { useData } from "../../store/DataContext";
import { chatList, lastMessageText } from "../../utils/chats";
import { t } from "../../i18n";
import styles from "./Chats.module.css";

function Chats() {
  const { members, currentUserId, messages, unread, chatSettings } = useData();

  const chats = chatList(members, currentUserId, chatSettings);

  return (
    <Page>
      <h1 className={styles.title}>{t("nav.chats")}</h1>

      <div className={styles.list}>
        {chats.map((c) => {
          const count = unread[c.id] ?? 0;
          return (
            <Link
              key={c.id}
              to={`/chats/${c.id}`}
              className={`${styles.item} ${count ? styles.unread : ""}`}
            >
              <Avatar letter={c.letter} tone={c.tone} photo={c.photo} size={48} />
              <div className={styles.text}>
                <span className={styles.name}>{c.name}</span>
                <span className={styles.last}>{lastMessageText(c, messages, members, currentUserId)}</span>
              </div>
              {count > 0 && <span className={styles.badge}>{count}</span>}
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

export default Chats;
