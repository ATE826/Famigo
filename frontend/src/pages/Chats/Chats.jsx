import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Page from "../../components/Page/Page";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import styles from "./Chats.module.css";

function Chats() {
  const { members, currentUserId, messages, unread, chatSettings } = useData();

  const personal = members
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({ id: m.id, name: m.name, letter: m.letter, tone: m.tone, photo: m.photo, personal: true }));
  const group = { id: GROUP_CHAT_ID, name: "Семья", letter: "С", tone: "green", personal: false };
  const chats = chatSettings[GROUP_CHAT_ID]?.pinned === false ? [...personal, group] : [group, ...personal];

  function lastMessage(chat) {
    const list = messages[chat.id] ?? [];
    const last = list[list.length - 1];
    if (!last) return "Нет сообщений";
    const mine = last.from === currentUserId;
    if (chat.personal) return mine ? `Вы: ${last.text}` : last.text;
    const author = mine ? "Вы" : (members.find((m) => m.id === last.from)?.name ?? "Бывший участник");
    return `${author}: ${last.text}`;
  }

  return (
    <Page>
      <h1 className={styles.title}>Чаты</h1>

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
                <span className={styles.last}>{lastMessage(c)}</span>
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
