import { useState } from "react";
import { Link } from "react-router-dom";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { daysUntilBirthday } from "../../utils/dates";
import { t } from "../../i18n";
import styles from "./Notifications.module.css";

const filters = ["all", "budget", "calendar", "fridge", "chat"];

const icons = {
  fridge: "fridge",
  calendar: "calendar",
  chat: "chat",
  budget: "wallet",
  family: "users",
};

function birthdayText(days) {
  if (days === 0) return t("notifications.congratulate");
  if (days === 1) return t("notifications.tomorrow");
  return t("notifications.inDays", { count: days });
}

function birthdayItems(members, currentUserId) {
  return members
    .filter((m) => m.id !== currentUserId && m.birthday)
    .map((m) => ({ member: m, days: daysUntilBirthday(m.birthday) }))
    .filter(({ days }) => days !== null && days <= 7)
    .map(({ member, days }) => ({
      id: `bday-${member.id}`,
      day: "today",
      type: "calendar",
      tone: "terra",
      title:
        days === 0
          ? t("notifications.birthdayToday", { name: member.name })
          : t("notifications.birthdaySoon", { name: member.name }),
      text: birthdayText(days),
      time: "",
      to: "/calendar",
      read: false,
    }));
}

const buildItems = (userName) => [
  {
    id: 1,
    day: "today",
    type: "fridge",
    tone: "terra",
    title: t("notifications.demo.milkTitle"),
    text: t("notifications.demo.milkText"),
    time: t("notifications.demo.minutesAgo", { count: 12 }),
    to: "/more/fridge",
    read: false,
  },
  {
    id: 2,
    day: "today",
    type: "calendar",
    tone: "green",
    title: t("notifications.demo.dinnerTitle"),
    text: t("notifications.demo.dinnerText"),
    time: "18:30",
    to: "/calendar",
    read: false,
  },
  {
    id: 3,
    day: "today",
    type: "chat",
    tone: "gray",
    title: t("notifications.demo.messageTitle"),
    text: t("notifications.demo.messageText"),
    time: "17:42",
    to: "/chats/family",
    read: false,
  },
  {
    id: 4,
    day: "yesterday",
    type: "budget",
    tone: "green",
    title: t("notifications.demo.expenseTitle", { name: userName }),
    text: t("notifications.demo.expenseText"),
    time: "15:20",
    to: "/budget/history",
    read: true,
  },
  {
    id: 5,
    day: "yesterday",
    type: "family",
    tone: "gray",
    title: t("notifications.demo.joinedTitle"),
    text: t("notifications.demo.joinedText"),
    time: "11:05",
    to: "/more/family",
    read: true,
  },
];

const days = ["today", "yesterday"];

function Notifications() {
  const { members, currentUserId, notificationSettings } = useData();
  const userName = members.find((m) => m.id === currentUserId)?.name ?? "";
  const [items, setItems] = useState(() => [
    ...birthdayItems(members, currentUserId),
    ...buildItems(userName),
  ]);
  const [filter, setFilter] = useState("all");

  const enabled = items.filter((item) => notificationSettings[item.type] !== false);
  const unreadCount = enabled.filter((item) => !item.read).length;
  const visible = enabled.filter((item) => filter === "all" || item.type === filter);

  function markRead(id) {
    setItems(items.map((item) => (item.id === id ? { ...item, read: true } : item)));
  }

  function markAllRead() {
    setItems(items.map((item) => ({ ...item, read: true })));
  }

  return (
    <Page>
      <PageHeader
        title={t("nav.notifications")}
        subtitle={unreadCount ? t("notifications.newCount", { count: unreadCount }) : t("notifications.noNew")}
        to="/main"
        right={
          <button
            type="button"
            className={styles.readAll}
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            {t("notifications.readAll")}
          </button>
        }
      />

      <ChipRow>
        {filters.map((f) => (
          <Chip key={f} active={f === filter} onClick={() => setFilter(f)}>
            {t(`notifications.filters.${f}`)}
          </Chip>
        ))}
      </ChipRow>

      <div className={styles.list}>
        {days.map((day) => {
          const dayItems = visible.filter((item) => item.day === day);
          if (dayItems.length === 0) return null;
          return (
            <section key={day}>
              <h2 className={styles.day}>{t(`notifications.${day}`)}</h2>
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
                    {!item.read && <span className={styles.dot} aria-label={t("notifications.unread")} />}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
        {visible.length === 0 && <p className={styles.empty}>{t("notifications.empty")}</p>}
      </div>
    </Page>
  );
}

export default Notifications;
