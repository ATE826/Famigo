import { useState } from "react";
import { Link } from "react-router-dom";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import styles from "./Notifications.module.css";

const filters = [
  { value: "all", label: "Все" },
  { value: "budget", label: "Бюджет" },
  { value: "calendar", label: "Календарь" },
  { value: "fridge", label: "Холодильник" },
  { value: "chat", label: "Чат" },
];

const icons = {
  fridge: "fridge",
  calendar: "calendar",
  chat: "chat",
  budget: "wallet",
  family: "users",
};

const initialItems = [
  {
    id: 1,
    day: "Сегодня",
    type: "fridge",
    tone: "terra",
    title: "Молоко заканчивается",
    text: "Квартира, холодильник. Остался 1 пакет.",
    time: "12 мин назад",
    to: "/more/fridge",
    read: false,
  },
  {
    id: 2,
    day: "Сегодня",
    type: "calendar",
    tone: "green",
    title: "Семейный ужин в 19:00",
    text: "Напоминание за 30 минут",
    time: "18:30",
    to: "/calendar",
    read: false,
  },
  {
    id: 3,
    day: "Сегодня",
    type: "chat",
    tone: "gray",
    title: "Новое сообщение от мамы",
    text: "Ужин сегодня в 19:00",
    time: "17:42",
    to: "/chats/family",
    read: false,
  },
  {
    id: 4,
    day: "Вчера",
    type: "budget",
    tone: "green",
    title: "Антон добавил расход",
    text: "Продукты, 2 500 ₽",
    time: "15:20",
    to: "/budget/history",
    read: true,
  },
  {
    id: 5,
    day: "Вчера",
    type: "family",
    tone: "gray",
    title: "Сестра присоединилась к семье",
    text: "Роль: участник",
    time: "11:05",
    to: "/more/family",
    read: true,
  },
];

const days = ["Сегодня", "Вчера"];

function Notifications() {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState("all");

  const unreadCount = items.filter((item) => !item.read).length;
  const visible = items.filter((item) => filter === "all" || item.type === filter);

  function markRead(id) {
    setItems(items.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }

  function markAllRead() {
    setItems(items.map((item) => ({ ...item, read: true })));
  }

  return (
    <Page>
      <PageHeader
        title="Уведомления"
        subtitle={unreadCount ? `${unreadCount} новых` : "Нет новых"}
        to="/main"
        right={
          <button
            type="button"
            className={styles.readAll}
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            Прочитать все
          </button>
        }
      />

      <ChipRow>
        {filters.map((f) => (
          <Chip key={f.value} active={f.value === filter} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      <div className={styles.list}>
        {days.map((day) => {
          const dayItems = visible.filter((item) => item.day === day);
          if (dayItems.length === 0) return null;
          return (
            <section key={day}>
              <h2 className={styles.day}>{day}</h2>
              {dayItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className={`${styles.item} ${item.read ? "" : styles.unread}`}
                  onClick={() => markRead(item.id)}
                >
                  <span className={`${styles.icon} ${styles[item.tone]}`}>
                    <Icon name={icons[item.type]} size={20} strokeWidth={1.8} />
                  </span>
                  <div className={styles.text}>
                    <span className={styles.title}>{item.title}</span>
                    <span className={styles.body}>{item.text}</span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.time}>{item.time}</span>
                    {!item.read && <span className={styles.dot} aria-label="Не прочитано" />}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
        {visible.length === 0 && <p className={styles.empty}>Уведомлений нет</p>}
      </div>
    </Page>
  );
}

export default Notifications;
