import { Fragment, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import { useData } from "../../store/DataContext";
import { GROUP_CHAT_ID } from "../../utils/chats";
import { roleLabels } from "../../utils/roles";
import { t } from "../../i18n";
import { TODAY, addDays, dateKey, dayTitle } from "../Calendar/data";
import styles from "./Chat.module.css";

// «Сегодня», «Вчера» или дата — над первым сообщением каждого дня.
function dayName(key) {
  if (key === dateKey(TODAY)) return t("calendar.today");
  if (key === dateKey(addDays(TODAY, -1))) return t("notifications.yesterday");
  const [year, month, day] = key.split("-").map(Number);
  return dayTitle(new Date(year, month - 1, day));
}

function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { members, currentUserId, messages, sendMessage, openChat, closeChat } = useData();
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const isGroup = id === GROUP_CHAT_ID;
  const partner = isGroup ? null : members.find((m) => m.id === id);
  const list = messages[id] ?? [];

  // Пока экран открыт, новые сообщения сразу отмечаются прочитанными.
  useEffect(() => {
    openChat(id);
    return () => closeChat(id);
  }, [id, openChat, closeChat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [list.length]);

  if (!isGroup && (!partner || partner.id === currentUserId)) {
    return <Navigate to="/chats" replace />;
  }

  function handleBack(e) {
    if (location.key !== "default") {
      e.preventDefault();
      navigate(-1);
    }
  }

  function handleSend(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    sendMessage(id, value);
    setText("");
  }

  const title = isGroup ? t("chats.family") : partner.name;
  const subtitle = isGroup
    ? t("plural.members", { count: members.length })
    : roleLabels[partner.role];
  const headerTo = isGroup ? `/chats/${id}/info` : `/more/family/${partner.id}`;

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link to="/chats" onClick={handleBack} className={styles.back} aria-label={t("common.back")}>
          <Icon name="back" />
        </Link>
        <Link to={headerTo} className={styles.headerLink} aria-label={t("chats.open", { name: title })}>
          {isGroup ? (
            <Avatar letter={title[0]} size={40} />
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
        {list.length === 0 && <p className={styles.empty}>{t("chats.empty")}</p>}

        {list.map((m, i) => {
          const dayLabel =
            i === 0 || list[i - 1].day !== m.day ? <div className={styles.day}>{dayName(m.day)}</div> : null;
          const text = m.deleted ? <i>{t("chats.deleted")}</i> : m.text;
          if (m.from === currentUserId) {
            return (
              <Fragment key={m.id}>
                {dayLabel}
                <div className={styles.mine}>
                  <div className={styles.bubbleMine}>{text}</div>
                  <span className={styles.meta}>
                    {m.time}
                    {m.status && `, ${m.status}`}
                  </span>
                </div>
              </Fragment>
            );
          }
          const author = members.find((member) => member.id === m.from);
          return (
            <Fragment key={m.id}>
              {dayLabel}
              <div className={styles.other}>
                <Avatar letter={author?.letter ?? "?"} tone={author?.tone ?? "cream"} photo={author?.photo} size={28} />
                <div className={styles.otherBody}>
                  <div className={styles.bubbleOther}>
                    {isGroup && <b className={styles.author}>{author?.name ?? t("common.formerMember")}</b>}
                    {text}
                  </div>
                  <span className={styles.meta}>{m.time}</span>
                </div>
              </div>
            </Fragment>
          );
        })}

        <div ref={endRef} />
      </div>

      <form className={styles.form} onSubmit={handleSend}>
        <label htmlFor="message" className={styles.srOnly}>
          {t("chats.message")}
        </label>
        <input
          id="message"
          type="text"
          placeholder={t("chats.placeholder")}
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className={styles.send} aria-label={t("chats.send")}>
          <Icon name="send" size={20} />
        </button>
      </form>
    </div>
  );
}

export default Chat;
