import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import styles from "./Chat.module.css";

const initialMessages = [
  { id: 1, from: "Мама", tone: "terra", text: "Ужин сегодня в 19:00", time: "17:42" },
  { id: 2, from: "me", text: "Хорошо, буду дома к семи.", time: "17:45", status: "прочитано" },
  { id: 3, from: "Папа", tone: "sage", text: "Я тоже.", time: "17:51" },
];

function Chat() {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    setMessages([...messages, { id: Date.now(), from: "me", text: value, time }]);
    setText("");
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link to="/chats" className={styles.back} aria-label="Назад">
          <Icon name="back" />
        </Link>
        <Avatar letter="С" size={40} />
        <div className={styles.headerText}>
          <h1 className={styles.title}>Семья</h1>
          <span className={styles.subtitle}>4 участника, 2 в сети</span>
        </div>
      </header>

      <div className={styles.messages}>
        <div className={styles.day}>Сегодня</div>

        {messages.map((m) =>
          m.from === "me" ? (
            <div key={m.id} className={styles.mine}>
              <div className={styles.bubbleMine}>{m.text}</div>
              <span className={styles.meta}>
                {m.time}
                {m.status && `, ${m.status}`}
              </span>
            </div>
          ) : (
            <div key={m.id} className={styles.other}>
              <Avatar letter={m.from[0]} tone={m.tone} size={28} />
              <div className={styles.otherBody}>
                <div className={styles.bubbleOther}>
                  <b className={styles.author}>{m.from}</b>
                  {m.text}
                </div>
                <span className={styles.meta}>{m.time}</span>
              </div>
            </div>
          ),
        )}

        <div className={styles.notice}>
          Молоко заканчивается.{" "}
          <Link to="/more/fridge" className={styles.noticeLink}>
            Проверить холодильник
          </Link>
        </div>
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
