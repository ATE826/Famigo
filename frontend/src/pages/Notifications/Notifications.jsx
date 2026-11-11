import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { daysUntilBirthday } from "../../utils/dates";
import { overdueMembers } from "../../utils/checkin";
import { getLocale, t } from "../../i18n";
import { TODAY, addDays, dateKey } from "../Calendar/data";
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

function safetyItems(alerts, members, checkIns, currentUserId) {
  const nameOf = (id) => members.find((m) => m.id === id)?.name ?? "";
  const sos = alerts
    .filter((a) => a.from !== currentUserId)
    .map((a) => ({
      id: `sos-${a.id}`,
      day: "today",
      type: "family",
      tone: "terra",
      title: t("safety.banner.from", { name: nameOf(a.from) }),
      text: a.place ? t(`map.places.${a.place}`) : t("safety.sos.unknownPlace"),
      time: new Date(a.at).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" }),
      to: "/map",
      read: false,
    }));
  const overdue = overdueMembers(members, checkIns)
    .filter((m) => m.id !== currentUserId)
    .map((m) => ({
      id: `checkin-${m.id}`,
      day: "today",
      type: "family",
      tone: "terra",
      title: t("safety.checkin.overdue", { name: m.name }),
      text: t("safety.checkin.overdueTime", { time: m.checkin.time }),
      time: m.checkin.time,
      to: `/chats/${m.id}`,
      read: false,
    }));
  return [...sos, ...overdue];
}

const tones = { budget: "green", calendar: "terra", fridge: "terra", chat: "gray", family: "gray" };

// Уведомление с сервера → карточка ленты.
function fromApi(item) {
  const created = new Date(item.createdAt);
  const key = dateKey(created);
  const day = key === dateKey(TODAY) ? "today" : key === dateKey(addDays(TODAY, -1)) ? "yesterday" : "earlier";
  const time =
    day === "earlier"
      ? created.toLocaleDateString(getLocale(), { day: "numeric", month: "short" })
      : created.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
  return {
    id: item.id,
    fromServer: true,
    day,
    type: item.type,
    tone: tones[item.type] ?? "gray",
    title: item.title,
    text: item.body ?? "",
    time,
    to: item.link?.startsWith("/") ? item.link : "/notifications",
    read: Boolean(item.readAt),
  };
}

const days = ["today", "yesterday", "earlier"];

function Notifications() {
  const {
    members,
    currentUserId,
    notificationSettings,
    alerts,
    checkIns,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    showError,
  } = useData();
  const [items, setItems] = useState(() => [
    ...safetyItems(alerts, members, checkIns, currentUserId),
    ...birthdayItems(members, currentUserId),
  ]);

  useEffect(() => {
    let cancelled = false;
    loadNotifications()
      .then((list) => {
        if (!cancelled) setItems((current) => [...current.filter((item) => !item.fromServer), ...list.map(fromApi)]);
      })
      .catch(showError);
    return () => {
      cancelled = true;
    };
  }, [loadNotifications, showError]);
  const [filter, setFilter] = useState("all");

  const enabled = items.filter((item) => notificationSettings[item.type] !== false);
  const unreadCount = enabled.filter((item) => !item.read).length;
  const visible = enabled.filter((item) => filter === "all" || item.type === filter);

  function markRead(id) {
    const item = items.find((x) => x.id === id);
    if (item?.fromServer && !item.read) markNotificationRead(id);
    setItems(items.map((x) => (x.id === id ? { ...x, read: true } : x)));
  }

  function markAllRead() {
    markAllNotificationsRead();
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
