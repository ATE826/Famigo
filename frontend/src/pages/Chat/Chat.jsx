import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import { plural } from "../../utils/plural";
import { roleLabels } from "../../utils/roles";
import styles from "./Chat.module.css";

function Chat() {
  const { id } = useParams();
  const { members, currentUserId, messages, sendMessage, markChatRead } = useData();
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const isGroup = id === GROUP_CHAT_ID;
  const partner = isGroup ? null : members.find((m) => m.id === id);
  const list = messages[id] ?? [];

  useEffect(() => {
    markChatRead(id);
  }, [id, markChatRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  if (!isGroup && (!partner || partner.id === currentUserId)) {
    return <Navigate to="/chats" replace />;
  }

  function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    sendMessage(id, value);
    setText("");
  }

  const title = isGroup ? "Семья" : partner.name;
  const subtitle = isGroup
    ? `${members.length} ${plural(members.length, ["участник", "участника", "участников"])}`
    : roleLabels[partner.role];
  const headerTo = isGroup ? `/chats/${id}/info` : `/more/family/${partner.id}`;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link to="/chats" className={styles.back} aria-label="Назад">
          <Icon name="back" />
        </Link>
        <Link to={headerTo} className={styles.headerLink} aria-label={`Открыть: ${title}`}>
          {isGroup ? (
            <Avatar letter="С" size={40} />
          ) : (
            <Avatar letter={partner.letter} tone={partner.tone} photo={partner.photo} size={40} />
          )}
          <div className={styles.headerText}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.subtitle}>{subtitle}</span>
          </div>
        </Link>
      </header>

      <div className={styles.messages}>
        <div className={styles.day}>Сегодня</div>

        {list.length === 0 && <p className={styles.empty}>Сообщений пока нет</p>}

        {list.map((m) => {
          if (m.from === currentUserId) {
            return (
              <div key={m.id} className={styles.mine}>
                <div className={styles.bubbleMine}>{m.text}</div>
                <span className={styles.meta}>
                  {m.time}
                  {m.status && `, ${m.status}`}
                </span>
              </div>
            );
          }
          const author = members.find((member) => member.id === m.from);
          return (
            <div key={m.id} className={styles.other}>
              <Avatar letter={author?.letter ?? "?"} tone={author?.tone ?? "cream"} photo={author?.photo} size={28} />
              <div className={styles.otherBody}>
                <div className={styles.bubbleOther}>
                  {isGroup && <b className={styles.author}>{author?.name ?? "Бывший участник"}</b>}
                  {m.text}
                </div>
                <span className={styles.meta}>{m.time}</span>
              </div>
            </div>
          );
        })}

        {isGroup && (
          <div className={styles.notice}>
            Молоко заканчивается.{" "}
            <Link to="/more/fridge" className={styles.noticeLink}>
              Проверить холодильник
            </Link>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className={styles.form} onSubmit={handleSend}>
        <label htmlFor="message" className={styles.srOnly}>
          Сообщение
        </label>
        <input
          id="message"
          type="text"
          placeholder="Написать сообщение..."
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className={styles.send} aria-label="Отправить">
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  );
}

export default Chat;
