import { useState } from "react";
import Card from "../../components/Card/Card";
import Avatar from "../../components/Avatar/Avatar";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import styles from "./BudgetHistory.module.css";

const filters = ["Август", "Категория", "Дом", "Участник"];

const groups = [
  {
    day: "17 августа",
    rows: [
      { who: "А", tone: "green", title: "Продукты", sub: "Квартира, Антон", amount: "-2 500 ₽" },
      { who: "М", tone: "terra", title: "Квартплата", sub: "Квартира, Мама", amount: "-1 800 ₽" },
    ],
  },
  {
    day: "16 августа",
    rows: [
      { who: "А", tone: "green", title: "Зарплата", sub: "Доход, Антон", amount: "+120 000 ₽", income: true },
    ],
  },
  {
    day: "15 августа",
    rows: [
      { who: "П", tone: "sage", title: "Транспорт", sub: "Бензин, Папа", amount: "-900 ₽" },
      { who: "М", tone: "terra", title: "Развлечения", sub: "Кино, Мама", amount: "-1 400 ₽" },
    ],
  },
];

function BudgetHistory() {
  const [active, setActive] = useState("Август");

  return (
    <Page>
      <PageHeader title="История" to="/budget" />

      <ChipRow>
        {filters.map((f) => (
          <Chip key={f} active={f === active} onClick={() => setActive(f)}>
            {f}
          </Chip>
        ))}
      </ChipRow>

      <Card flush className={styles.list}>
        {groups.map((g) => (
          <div key={g.day}>
            <div className={styles.day}>{g.day}</div>
            {g.rows.map((r, i) => (
              <div key={i} className={styles.row}>
                <Avatar letter={r.who} tone={r.tone} size={38} />
                <div className={styles.text}>
                  <span className={styles.title}>{r.title}</span>
                  <span className={styles.sub}>{r.sub}</span>
                </div>
                <span className={`${styles.amount} ${r.income ? styles.income : ""}`}>{r.amount}</span>
              </div>
            ))}
          </div>
        ))}
      </Card>
    </Page>
  );
}

export default BudgetHistory;
