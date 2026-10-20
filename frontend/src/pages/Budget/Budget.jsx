import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Card from "../../components/Card/Card";
import Fab from "../../components/Fab/Fab";
import MonthSwitcher from "../../components/MonthSwitcher/MonthSwitcher";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import useSwipe from "../../hooks/useSwipe";
import { addMonths, monthLabel } from "../Calendar/data";
import { useData } from "../../store/DataContext";
import {
  balanceUpTo,
  CURRENT_MONTH,
  byCategory,
  earliestMonthKey,
  formatMoney,
  monthKey,
  opsInMonth,
  parseMonth,
  totalOf,
} from "../../utils/budget";
import styles from "./Budget.module.css";

function CategoryList({ items }) {
  const max = Math.max(1, ...items.map((c) => c.amount));
  return items.map((c) => (
    <div key={c.name} className={styles.category}>
      <div className={styles.categoryRow}>
        <span className={styles.categoryName}>{c.name}</span>
        <span className={styles.categorySum}>{formatMoney(c.amount)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${(c.amount / max) * 100}%` }} />
      </div>
    </div>
  ));
}

function Budget() {
  const { operations } = useData();
  const [params, setParams] = useSearchParams();
  const [direction, setDirection] = useState("fade");

  const month = parseMonth(params.get("month"));
  const key = monthKey(month);
  const isCurrent = key === CURRENT_MONTH;

  const monthOps = opsInMonth(operations, key);
  const income = totalOf(monthOps, "income");
  const expenses = totalOf(monthOps, "expense");
  const balance = balanceUpTo(operations, key);
  const expenseCategories = byCategory(monthOps, "expense");
  const incomeCategories = byCategory(monthOps, "income");

  const prevDisabled = key <= earliestMonthKey(operations);
  const nextDisabled = key >= CURRENT_MONTH;

  function go(step) {
    setDirection(step > 0 ? "next" : "prev");
    setParams({ month: monthKey(addMonths(month, step)) }, { replace: true });
  }

  const swipe = useSwipe({
    onLeft: () => !nextDisabled && go(1),
    onRight: () => !prevDisabled && go(-1),
  });

  return (
    <Page fab {...swipe}>
      <PageHeader
        title="Бюджет"
        right={
          <Link to={`/budget/history?month=${key}`} className={styles.history}>
            История
          </Link>
        }
      />

      <MonthSwitcher
        label={monthLabel(month)}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        prevDisabled={prevDisabled}
        nextDisabled={nextDisabled}
      />

      <div key={key} className={`${styles.view} ${styles[direction]}`}>
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>{isCurrent ? "Доступно" : "Остаток на конец месяца"}</span>
          <span className={styles.summaryAmount}>{formatMoney(balance)}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Расходы</span>
            <span className={styles.statValue}>{formatMoney(expenses)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Доходы</span>
            <span className={styles.statValue}>{formatMoney(income)}</span>
          </div>
        </div>

        {monthOps.length === 0 ? (
          <p className={styles.empty}>В этом месяце операций нет</p>
        ) : (
          <>
            {expenseCategories.length > 0 && (
              <Card className={styles.card}>
                <h2 className={styles.cardTitle}>Категории расходов</h2>
                <CategoryList items={expenseCategories} />
              </Card>
            )}

            {incomeCategories.length > 0 && (
              <Card className={styles.card}>
                <h2 className={styles.cardTitle}>Доходы по категориям</h2>
                <CategoryList items={incomeCategories} />
              </Card>
            )}
          </>
        )}
      </div>

      <Fab to="/budget/add" label="Добавить операцию" />
    </Page>
  );
}

export default Budget;
