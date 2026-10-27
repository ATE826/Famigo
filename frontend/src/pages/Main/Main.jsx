import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import SosButton from "../../components/SosButton/SosButton";
import { isSpoiled, needsAttention } from "../Fridge/products";
import { useData } from "../../store/DataContext";
import { chatList, lastMessageOf, lastMessageText } from "../../utils/chats";
import { homeOf } from "../../utils/homes";
import { productsLabel } from "../../utils/plural";
import { greeting } from "../../utils/greeting";
import { checkedToday, overdueMembers } from "../../utils/checkin";
import useNow from "../../hooks/useNow";
import {
  CURRENT_MONTH,
  balanceUpTo,
  formatMoney,
  monthInSentence,
  parseMonth,
  monthlyTotals,
} from "../../utils/budget";
import { getLocale, t } from "../../i18n";
import { TODAY, birthdayEvents, eventsOn } from "../Calendar/data";
import styles from "./Main.module.css";

const CHART_MONTHS = 5;
const MAX_ALERTS = 2;
const MAX_TASKS = 3;

function Main() {
  const {
    operations,
    openingBalance,
    events,
    unreadNotifications,
    members,
    currentUserId,
    products,
    homes,
    messages,
    unread,
    chatSettings,
    plan,
    checkIns,
    checkIn,
  } = useData();
  const myHome = homeOf(homes, currentUserId);
  const myProducts = myHome ? products.filter((p) => p.homeId === myHome.id) : [];
  const alerts = myProducts
    .filter(needsAttention)
    .sort((a, b) => Number(isSpoiled(b)) - Number(isSpoiled(a)));
  const fridgeLink = myHome ? `/more/fridge?home=${myHome.id}` : "/more/fridge";
  const tasks = myHome ? myHome.tasks.filter((task) => !task.done) : [];
  const me = members.find((m) => m.id === currentUserId);
  const todayEvents = eventsOn(TODAY, [...events, ...birthdayEvents(members, TODAY.getFullYear())]);
  const chats = chatList(members, currentUserId, chatSettings);
  const freshChat = chats.find((c) => (unread[c.id] ?? 0) > 0);
  const userName = me?.name ?? "";
  const userLetter = me?.letter ?? "";
  const key = CURRENT_MONTH;
  const month = parseMonth(key);
  const months = monthlyTotals(operations, key, CHART_MONTHS);
  const maxAmount = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const current = months[months.length - 1];
  const net = current.income - current.expense;
  const hasSpoiled = alerts.some(isSpoiled);
  const now = useNow();
  const showCheckin = plan.checkin && Boolean(me?.checkin?.enabled);
  const overdue = plan.checkin ? overdueMembers(members, checkIns, now).filter((m) => m.id !== currentUserId) : [];
  const barHeight = (amount) => `${Math.max((amount / maxAmount) * 100, amount > 0 ? 6 : 2)}%`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>F</span>
          <span className={styles.brandName}>Famigo</span>
        </div>
        <div className={styles.actions}>
          <SosButton />
          <Link to="/notifications" className={styles.bell} aria-label={t("nav.notifications")}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
            </svg>
            {unreadNotifications > 0 && (
              <span className={styles.badge}>{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>
            )}
          </Link>
          <Link to="/profile" className={styles.avatarLink} aria-label={t("nav.profile")}>
            <Avatar letter={userLetter} tone={me?.tone} photo={me?.photo} size={44} />
          </Link>
        </div>
      </header>

      <div className={styles.greetingRow}>
        <div className={styles.greeting}>
          <h1 className={styles.title}>
            {greeting()}, {userName}
          </h1>
          <Link to="/more/family" className={styles.family}>
            {t("main.yourFamily", { count: members.length })}
          </Link>
        </div>
        <Link to="/more/family" className={styles.stack} aria-label={t("main.familyMembers")}>
          {members.map((m) => (
            <span key={m.id} className={styles.stackItem}>
              <Avatar letter={m.letter} tone={m.tone} photo={m.photo} size={44} />
            </span>
          ))}
        </Link>
      </div>

      {(showCheckin || overdue.length > 0) && (
        <div className={styles.notices}>
          {overdue.map((member) => (
            <div key={member.id} className={`${styles.notice} ${styles.noticeWarn}`}>
              <Avatar letter={member.letter} tone={member.tone} photo={member.photo} size={44} />
              <span className={styles.noticeText}>
                <span className={styles.noticeTitle}>{member.name}</span>
                <span className={styles.noticeSub}>{t("safety.checkin.overdueShort", { time: member.checkin.time })}</span>
              </span>
              <Link to={`/chats/${member.id}`} className={styles.noticeAction}>
                {t("safety.checkin.write")}
              </Link>
            </div>
          ))}

          {showCheckin &&
            (checkedToday(checkIns, me.id) ? (
              <div className={styles.notice}>
                <span className={`${styles.noticeIcon} ${styles.noticeIconOk}`}>
                  <Icon name="check" size={22} strokeWidth={2.2} />
                </span>
                <span className={styles.noticeText}>
                  <span className={styles.noticeTitle}>
                    {t("safety.checkin.done", {
                      time: new Date(checkIns[me.id]).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" }),
                    })}
                  </span>
                  <span className={styles.noticeSub}>{t("safety.checkin.doneSub")}</span>
                </span>
              </div>
            ) : (
              <div className={styles.notice}>
                <span className={styles.noticeIcon}>
                  <Icon name="shield" size={22} strokeWidth={1.8} />
                </span>
                <span className={styles.noticeText}>
                  <span className={styles.noticeTitle}>{t("safety.checkin.title")}</span>
                  <span className={styles.noticeSub}>{t("safety.checkin.prompt", { time: me.checkin.time })}</span>
                </span>
                <button type="button" className={styles.noticeAction} onClick={checkIn}>
                  {t("safety.checkin.action")}
                </button>
              </div>
            ))}

        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.colMain}>
          <Link to="/budget" className={styles.link}>
            <Card>
              <div className={styles.balance}>
                <span className={styles.label}>{t("main.availableIn", { month: monthInSentence(month) })}</span>
                <span className={styles.amount}>{formatMoney(balanceUpTo(operations, key, openingBalance))}</span>
                <span className={`${styles.net} ${net < 0 ? styles.netDown : ""}`}>
                  {t("main.monthNet", { amount: `${net < 0 ? "−" : "+"}${formatMoney(Math.abs(net))}` })}
                </span>
              </div>
              <div className={styles.chart} role="img" aria-label={t("main.chartLabel")}>
                {months.map((m) => (
                  <div
                    key={m.key}
                    className={`${styles.monthCol} ${m.key === key ? styles.monthCurrent : ""}`}
                    title={t("main.chartTooltip", {
                      month: m.label,
                      income: formatMoney(m.income),
                      expense: formatMoney(m.expense),
                    })}
                  >
                    <div className={styles.pair}>
                      <div className={styles.barIncome} style={{ height: barHeight(m.income) }} />
                      <div className={styles.barExpense} style={{ height: barHeight(m.expense) }} />
                    </div>
                    <span className={styles.monthLabel}>{m.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.dot} ${styles.dotIncome}`} />
                  {t("budget.income")}
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.dot} ${styles.dotExpense}`} />
                  {t("budget.expenses")}
                </span>
              </div>
            </Card>
          </Link>

          {myHome && myProducts.length === 0 && (
            <Link
              to={`/more/fridge/add?home=${myHome.id}`}
              className={`${styles.link} ${styles.fridgeOk} ${styles.fridgeEmpty} ${styles.later}`}
            >
              <span className={styles.fridgeIcon}>
                <Icon name="fridge" size={20} strokeWidth={1.8} />
              </span>
              <div className={styles.fridgeText}>
                <span className={styles.fridgeTitle}>{t("main.noFood")}</span>
                <span className={styles.fridgeSub}>{t("main.fridgeEmpty", { home: myHome.name })}</span>
              </div>
              <Icon name="plus" size={18} className={styles.emptyPlus} />
            </Link>
          )}

          {myHome && myProducts.length > 0 && alerts.length === 0 && (
            <Link to={fridgeLink} className={`${styles.link} ${styles.fridgeOk} ${styles.later}`}>
              <span className={`${styles.fridgeIcon} ${styles.fridgeIconOk}`}>
                <Icon name="fridge" size={20} strokeWidth={1.8} />
              </span>
              <div className={styles.fridgeText}>
                <span className={styles.fridgeTitle}>{t("main.fridgeOk")}</span>
                <span className={styles.fridgeSubOk}>
                  {myHome.name} · {productsLabel(myProducts.length)}
                </span>
              </div>
              <Icon name="chevron" size={18} className={styles.chevron} />
            </Link>
          )}

          {alerts.length > 0 && !hasSpoiled && (
            <Link to={fridgeLink} className={`${styles.link} ${styles.fridgeOk} ${styles.fridgeEmpty} ${styles.later}`}>
              <span className={styles.fridgeIcon}>
                <Icon name="fridge" size={20} strokeWidth={1.8} />
              </span>
              <div className={styles.fridgeText}>
                <span className={styles.fridgeTitle}>{t("main.fridgeTitle", { home: myHome.name })}</span>
                <span className={styles.fridgeSub}>{t("main.needAttention", { count: alerts.length })}</span>
              </div>
              <Icon name="chevron" size={18} className={styles.emptyPlus} />
            </Link>
          )}

          {hasSpoiled && (
            <section className={`${styles.fridge} ${styles.later}`}>
              <div className={styles.fridgeHead}>
                <span className={styles.fridgeIcon}>
                  <Icon name="fridge" size={20} strokeWidth={1.8} />
                </span>
                <div className={styles.fridgeText}>
                  <h2 className={styles.fridgeTitle}>{t("main.fridgeTitle", { home: myHome.name })}</h2>
                  <span className={styles.fridgeSub}>
                    {t("main.needAttention", { count: alerts.length })}
                  </span>
                </div>
              </div>

              {alerts.slice(0, MAX_ALERTS).map((p) => (
                <Link key={p.id} to={`/more/fridge/${p.id}/edit`} className={styles.alert}>
                  <span className={styles.alertName}>{p.name}</span>
                  <span className={`${styles.alertStatus} ${isSpoiled(p) ? styles.alertSpoiled : styles.alertLow}`}>
                    {isSpoiled(p) ? t("fridge.spoiled") : t("fridge.low")}
                  </span>
                </Link>
              ))}

              {alerts.length > MAX_ALERTS && (
                <Link to={fridgeLink} className={styles.alertMore}>
                  {t("main.moreItems", { items: productsLabel(alerts.length - MAX_ALERTS) })}
                  <Icon name="chevron" size={16} />
                </Link>
              )}
            </section>
          )}
        </div>

        <div className={styles.colSide}>
          <Link to="/calendar" className={styles.link}>
            <Card>
              <h2 className={styles.cardTitle}>{t("calendar.today")}</h2>
              {todayEvents.length === 0 && <p className={styles.tasksEmpty}>{t("calendar.noEvents")}</p>}
              {todayEvents.map((ev) => (
                <div key={ev.id} className={styles.event}>
                  <span className={styles.eventLine} />
                  <div className={styles.eventText}>
                    <span className={styles.eventTime}>{ev.time}</span>
                    <span className={styles.eventTitle}>{ev.title}</span>
                  </div>
                </div>
              ))}
            </Card>
          </Link>

          <Card className={styles.later}>
            <div className={styles.cardHead}>
              <div className={styles.cardHeadText}>
                <h2 className={styles.cardTitle}>{t("main.tasks")}</h2>
                {myHome && <span className={styles.taskHome}>{myHome.name}</span>}
              </div>
              {tasks.length > 0 && <span className={styles.count}>{tasks.length}</span>}
            </div>
            {tasks.slice(0, MAX_TASKS).map((task) => (
              <Link key={task.id} to={`/more/home/${myHome.id}`} className={styles.task}>
                <span className={styles.taskDot} />
                <span className={styles.taskText}>{task.text}</span>
              </Link>
            ))}
            {!myHome && (
              <Link to="/more/homes" className={styles.more}>
                {t("main.chooseHome")}
                <Icon name="chevron" size={16} />
              </Link>
            )}
            {myHome && tasks.length === 0 && <p className={styles.tasksEmpty}>{t("main.allDone")}</p>}
            {tasks.length > MAX_TASKS && (
              <Link to={`/more/home/${myHome.id}`} className={styles.more}>
                {t("main.moreTasks", { count: tasks.length - MAX_TASKS })}
                <Icon name="chevron" size={16} />
              </Link>
            )}
          </Card>

          <Card className={`${styles.desktopOnly} ${styles.later}`}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{t("nav.chats")}</h2>
              <Link to="/chats" className={styles.open}>
                {t("main.allChats")}
              </Link>
            </div>
            <div className={styles.quickChats}>
              {chats.map((c) => {
                const count = unread[c.id] ?? 0;
                return (
                  <Link
                    key={c.id}
                    to={`/chats/${c.id}`}
                    className={styles.quickChat}
                    aria-label={count ? t("main.unreadIn", { name: c.name, count }) : c.name}
                  >
                    <span className={styles.quickAvatar}>
                      <Avatar letter={c.letter} tone={c.tone} photo={c.photo} size={52} />
                      {count > 0 && <span className={styles.quickBadge}>{count}</span>}
                    </span>
                    <span className={styles.quickName}>{c.name}</span>
                  </Link>
                );
              })}
            </div>
            {freshChat ? (
              <Link to={`/chats/${freshChat.id}`} className={styles.fresh}>
                <span className={styles.freshDot} />
                <span className={styles.freshText}>
                  <span className={styles.freshTitle}>
                    {freshChat.personal ? freshChat.name : t("main.groupChat", { name: freshChat.name })}
                    <span className={styles.freshTime}>{lastMessageOf(freshChat, messages)?.time}</span>
                  </span>
                  <span className={styles.freshLast}>
                    {lastMessageText(freshChat, messages, members, currentUserId)}
                  </span>
                </span>
              </Link>
            ) : (
              <p className={styles.tasksEmpty}>{t("main.noNewMessages")}</p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

export default Main;