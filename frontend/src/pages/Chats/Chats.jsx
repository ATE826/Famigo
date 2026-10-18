import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Page from "../../components/Page/Page";
import styles from "./Chats.module.css";

const chats = [
  { letter: "С", tone: "green", name: "Семья", last: "Папа: Я тоже.", unread: 2 },
  { letter: "М", tone: "terra", name: "Мама", last: "Не забудь купить молоко" },
  { letter: "П", tone: "sage", name: "Папа", last: "Буду дома через час" },
];

function Chats() {
  return (
    <Page>
      <h1 className={styles.title}>Чаты</h1>

      <div className={styles.list}>
        {chats.map((c) => (
          <Link
            key={c.name}
            to="/chats/family"
            className={`${styles.item} ${c.unread ? styles.unread : ""}`}
          >
            <Avatar letter={c.letter} tone={c.tone} size={48} />
            <div className={styles.text}>
              <span className={styles.name}>{c.name}</span>
              <span className={styles.last}>{c.last}</span>
            </div>
            {c.unread && <span className={styles.badge}>{c.unread}</span>}
          </Link>
        ))}
      </div>
    </Page>
  );
}

export default Chats;
