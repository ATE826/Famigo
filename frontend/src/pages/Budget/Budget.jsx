import { Link } from "react-router-dom";
import Card from "../../components/Card/Card";
import Fab from "../../components/Fab/Fab";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import styles from "./Budget.module.css";

const weeks = [55, 80, 100, 30, 12];
const currentWeek = 2;

const categories = [
  { name: "Продукты", sum: "24 500 ₽", share: 91 },
  { name: "Дом", sum: "18 000 ₽", share: 67 },
  { name: "Транспорт", sum: "9 200 ₽", share: 34 },
  { name: "Развлечения", sum: "7 800 ₽", share: 29 },
  { name: "Другое", sum: "26 920 ₽", share: 100 },
];

function Budget() {
  return (
    <Page fab>
      <PageHeader
        title="Бюджет"
        subtitle="Август 2026"
        right={
          <Link to="/budget/history" className={styles.history}>
            История
          </Link>
        }
      />

      <div className={styles.summary}>
        <span className={styles.summaryLabel}>Доступно</span>
        <span className={styles.summaryAmount}>163 580 ₽</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Расходы</span>
          <span className={styles.statValue}>86 420 ₽</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Доходы</span>
          <span className={styles.statValue}>120 000 ₽</span>
        </div>
      </div>

      <Card className={styles.card}>
        <h2 className={styles.cardTitle}>Расходы по неделям</h2>
        <div className={styles.bars} role="img" aria-label="График расходов по неделям">
          {weeks.map((h, i) => (
            <div
              key={i}
              className={`${styles.bar} ${i === currentWeek ? styles.barActive : ""}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </Card>

      <Card className={styles.card}>
        <h2 className={styles.cardTitle}>Категории</h2>
        {categories.map((c) => (
          <div key={c.name} className={styles.category}>
            <div className={styles.categoryRow}>
              <span className={styles.categoryName}>{c.name}</span>
              <span className={styles.categorySum}>{c.sum}</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${c.share}%` }} />
            </div>
          </div>
        ))}
      </Card>

      <Fab to="/budget/add" label="Добавить операцию" />
    </Page>
  );
}

export default Budget;
