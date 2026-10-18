import { Link } from "react-router-dom";
import Card from "../../components/Card/Card";
import { useData } from "../../store/DataContext";
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

const events = [
  { time: "19:00", title: "Семейный ужин" },
  { time: "21:00", title: "Фильм" },
];

function Main() {
  const { operations } = useData();
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
          <Link to="/profile" className={styles.avatar} aria-label="Профиль">
            А
          </Link>
        </div>
      </header>

      <div className={styles.greeting}>
        <h1 className={styles.title}>Добрый вечер, Антон</h1>
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

      <Link to="/more/fridge" className={`${styles.link} ${styles.fridge}`}>
        <span className={styles.fridgeIcon}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3h12v18H6zM6 10h12M9 6v1.5M9 13v3" />
          </svg>
        </span>
        <div className={styles.fridgeText}>
          <span className={styles.fridgeTitle}>Молоко заканчивается</span>
          <span className={styles.fridgeSub}>Добавить в список продуктов</span>
        </div>
      </Link>

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
    </main>
  );
}

export default Main;