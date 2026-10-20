import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import { isSpoiled, needsAttention } from "../Fridge/products";
import { useData } from "../../store/DataContext";
import { homeOf } from "../../utils/homes";
import { plural, productsLabel } from "../../utils/plural";
import { greeting } from "../../utils/greeting";
import {
  CURRENT_MONTH,
  balanceUpTo,
  formatMoney,
  monthPrepositional,
  parseMonth,
  monthlyTotals,
} from "../../utils/budget";
import styles from "./Main.module.css";

const CHART_MONTHS = 5;
const MAX_ALERTS = 2;
const MAX_TASKS = 3;

const events = [
  { time: "19:00", title: "Семейный ужин" },
  { time: "21:00", title: "Фильм" },
];

function Main() {
  const { operations, members, currentUserId, products, homes } = useData();
  const alerts = products
    .filter(needsAttention)
    .sort((a, b) => Number(isSpoiled(b)) - Number(isSpoiled(a)));
  const myHome = homeOf(homes, currentUserId);
  const tasks = myHome ? myHome.tasks.filter((t) => !t.done) : [];
  const me = members.find((m) => m.id === currentUserId);
  const userName = me?.name ?? "";
  const userLetter = me?.letter ?? "";
  const key = CURRENT_MONTH;
  const month = parseMonth(key);
  const months = monthlyTotals(operations, key, CHART_MONTHS);
  const maxAmount = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const barHeight = (amount) => `${Math.max((amount / maxAmount) * 100, amount > 0 ? 6 : 2)}%`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>F</span>
          <span className={styles.brandName}>Famigo</span>
        </div>
        <div className={styles.actions}>
          <Link to="/notifications" className={styles.bell} aria-label="Уведомления">
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
            <span className={styles.badge}>3</span>
          </Link>
          <Link to="/profile" className={styles.avatarLink} aria-label="Профиль">
            <Avatar letter={userLetter} tone={me?.tone} photo={me?.photo} size={44} />
          </Link>
        </div>
      </header>

      <div className={styles.greeting}>
        <h1 className={styles.title}>
          {greeting()}, {userName}
        </h1>
        <Link to="/more/family" className={styles.family}>
          Ваша семья: 4 человека
        </Link>
      </div>

      <Link to="/budget" className={styles.link}>
        <Card>
          <div className={styles.balance}>
            <span className={styles.label}>Доступно в {monthPrepositional(month)}</span>
            <span className={styles.amount}>{formatMoney(balanceUpTo(operations, key))}</span>
          </div>
          <div className={styles.chart} role="img" aria-label="Доходы и расходы по месяцам">
            {months.map((m) => (
              <div
                key={m.key}
                className={styles.monthCol}
                title={`${m.label}: доходы ${formatMoney(m.income)}, расходы ${formatMoney(m.expense)}`}
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
              Доходы
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotExpense}`} />
              Расходы
            </span>
          </div>
        </Card>
      </Link>

      {alerts.length === 0 && (
        <Link to="/more/fridge" className={`${styles.link} ${styles.fridgeOk}`}>
          <span className={`${styles.fridgeIcon} ${styles.fridgeIconOk}`}>
            <Icon name="fridge" size={20} strokeWidth={1.8} />
          </span>
          <div className={styles.fridgeText}>
            <span className={styles.fridgeTitle}>В холодильнике всё в порядке</span>
            <span className={styles.fridgeSubOk}>
              {productsLabel(products.length)} · ничего не испортилось
            </span>
          </div>
          <Icon name="chevron" size={18} className={styles.chevron} />
        </Link>
      )}

      {alerts.length > 0 && (
        <section className={styles.fridge}>
          <div className={styles.fridgeHead}>
            <span className={styles.fridgeIcon}>
              <Icon name="fridge" size={20} strokeWidth={1.8} />
            </span>
            <div className={styles.fridgeText}>
              <h2 className={styles.fridgeTitle}>Холодильник</h2>
              <span className={styles.fridgeSub}>
                {alerts.length} {plural(alerts.length, ["продукт требует", "продукта требуют", "продуктов требуют"])} внимания
              </span>
            </div>
          </div>

          {alerts.slice(0, MAX_ALERTS).map((p) => (
            <Link key={p.id} to={`/more/fridge?home=${p.homeId}`} className={styles.alert}>
              <span className={styles.alertName}>{p.name}</span>
              <span className={styles.alertHome}>{homes.find((h) => h.id === p.homeId)?.name}</span>
              <span className={`${styles.alertStatus} ${isSpoiled(p) ? styles.alertSpoiled : styles.alertLow}`}>
                {isSpoiled(p) ? "Испорчено" : "Заканчивается"}
              </span>
            </Link>
          ))}

          {alerts.length > MAX_ALERTS && (
            <Link to="/more/fridge" className={styles.alertMore}>
              Ещё {productsLabel(alerts.length - MAX_ALERTS)}
              <Icon name="chevron" size={16} />
            </Link>
          )}
        </section>
      )}

      <Link to="/calendar" className={styles.link}>
        <Card>
          <h2 className={styles.cardTitle}>Сегодня</h2>
          {events.map((ev) => (
            <div key={ev.time} className={styles.event}>
              <span className={styles.eventLine} />
              <div className={styles.eventText}>
                <span className={styles.eventTime}>{ev.time}</span>
                <span className={styles.eventTitle}>{ev.title}</span>
              </div>
            </div>
          ))}
        </Card>
      </Link>

      <Card>
        <div className={styles.cardHead}>
          <div className={styles.cardHeadText}>
            <h2 className={styles.cardTitle}>Дела по дому</h2>
            {myHome && <span className={styles.taskHome}>{myHome.name}</span>}
          </div>
          {tasks.length > 0 && <span className={styles.count}>{tasks.length}</span>}
        </div>
        {tasks.slice(0, MAX_TASKS).map((t) => (
          <Link key={t.id} to={`/more/home/${myHome.id}`} className={styles.task}>
            <span className={styles.taskDot} />
            <span className={styles.taskText}>{t.text}</span>
          </Link>
        ))}
        {!myHome && (
          <Link to="/more/homes" className={styles.more}>
            Выберите дом, в котором живёте
            <Icon name="chevron" size={16} />
          </Link>
        )}
        {myHome && tasks.length === 0 && <p className={styles.tasksEmpty}>Все дела сделаны</p>}
        {tasks.length > MAX_TASKS && (
          <Link to={`/more/home/${myHome.id}`} className={styles.more}>
            Ещё {tasks.length - MAX_TASKS} {plural(tasks.length - MAX_TASKS, ["дело", "дела", "дел"])}
            <Icon name="chevron" size={16} />
          </Link>
        )}
      </Card>
    </main>
  );
}

export default Main;