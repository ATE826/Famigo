import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../../components/Card/Card";
import Avatar from "../../components/Avatar/Avatar";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import MonthSwitcher from "../../components/MonthSwitcher/MonthSwitcher";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { addMonths, dayTitle, monthLabel } from "../Calendar/data";
import { useData } from "../../store/DataContext";
import { CURRENT_MONTH, earliestMonthKey, formatMoney, monthKey, opsInMonth, parseMonth } from "../../utils/budget";
import styles from "./BudgetHistory.module.css";

const filters = [
  { value: "all", label: "Все" },
  { value: "expense", label: "Расходы" },
  { value: "income", label: "Доходы" },
];

function BudgetHistory() {
  const { operations, members } = useData();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");

  const month = parseMonth(params.get("month"));
  const key = monthKey(month);

  const visible = opsInMonth(operations, key)
    .filter((o) => filter === "all" || o.type === filter)
    .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));

  const days = [...new Set(visible.map((o) => o.date))];

  function go(step) {
    setParams({ month: monthKey(addMonths(month, step)) }, { replace: true });
  }

  return (
    <Page>
      <PageHeader title="История" to="/budget" />

      <MonthSwitcher
        label={monthLabel(month)}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        prevDisabled={key <= earliestMonthKey(operations)}
        nextDisabled={key >= CURRENT_MONTH}
      />

      <ChipRow>
        {filters.map((f) => (
          <Chip key={f.value} active={f.value === filter} onClick={() => setFilter(f.value)}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      {days.length === 0 ? (
        <p className={styles.empty}>Операций нет</p>
      ) : (
        <Card flush className={styles.list}>
          {days.map((day) => {
            const [year, mon, dayNumber] = day.split("-").map(Number);
            return (
              <div key={day}>
                <div className={styles.day}>{dayTitle(new Date(year, mon - 1, dayNumber))}</div>
                {visible
                  .filter((o) => o.date === day)
                  .map((o) => {
                    const member = members.find((m) => m.id === o.who);
                    const isIncome = o.type === "income";
                    return (
                      <div key={o.id} className={styles.row}>
                        <Avatar letter={member?.letter ?? "?"} tone={member?.tone ?? "gray"} size={38} />
                        <div className={styles.text}>
                          <span className={styles.title}>{o.title || o.desc || o.category}</span>
                          <span className={styles.sub}>
                            {o.category}, {member?.name ?? "Бывший участник"}
                          </span>
                        </div>
                        <span className={`${styles.amount} ${isIncome ? styles.income : ""}`}>
                          {isIncome ? "+" : "-"}
                          {formatMoney(o.amount)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

export default BudgetHistory;
