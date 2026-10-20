import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Card from "../../components/Card/Card";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Fab from "../../components/Fab/Fab";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Select from "../../components/Select/Select";
import { useData } from "../../store/DataContext";
import { homeOf } from "../../utils/homes";
import { productsLabel } from "../../utils/plural";
import { categories, categoryLabel, expiryLabel, isLow, statusOf, unitLabel } from "./products";
import { t } from "../../i18n";
import styles from "./Fridge.module.css";

const ALL = "all";
const filters = [ALL, ...categories];

function Fridge() {
  const { homes, products, fridgeHomeId, setFridgeHomeId, changeQty, currentUserId } = useData();
  const [params] = useSearchParams();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");

  const lockedHome = homes.find((h) => h.id === params.get("home"));
  const home =
    lockedHome ??
    homes.find((h) => h.id === fridgeHomeId) ??
    homeOf(homes, currentUserId) ??
    homes[0];
  const homeProducts = products.filter((p) => p.homeId === home.id);

  const visible = homeProducts.filter(
    (p) =>
      (category === ALL || p.cat === category) &&
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Page fab>
      <PageHeader
        title={t("fridge.title")}
        subtitle={`${home.name}, ${productsLabel(homeProducts.length)}`}
        to={lockedHome ? `/more/home/${home.id}` : "/more"}
      />

      {!lockedHome && (
        <Select
          id="home"
          label={t("fridge.home")}
          value={home.id}
          onChange={(e) => setFridgeHomeId(e.target.value)}
        >
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </Select>
      )}

      <div>
        <label htmlFor="search" className={styles.srOnly}>
          {t("fridge.search")}
        </label>
        <input
          id="search"
          type="search"
          placeholder={t("fridge.searchPlaceholder")}
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <ChipRow>
        {filters.map((c) => (
          <Chip key={c} active={c === category} onClick={() => setCategory(c)}>
            {c === ALL ? t("fridge.all") : categoryLabel(c)}
          </Chip>
        ))}
      </ChipRow>

      <Card flush>
        {visible.map((p) => (
          <div key={p.id} className={styles.row}>
            <Link to={`/more/fridge/${p.id}/edit`} className={styles.text} aria-label={t("fridge.edit", { name: p.name })}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.badges}>
                <span className={`${styles.exp} ${styles[statusOf(p)]}`}>{expiryLabel(p)}</span>
                {isLow(p) && <span className={`${styles.exp} ${styles.warn}`}>{t("fridge.low")}</span>}
              </span>
            </Link>
            <button type="button" className={styles.step} aria-label={t("fridge.less")} onClick={() => changeQty(p.id, -1)}>
              −
            </button>
            <span className={styles.qty}>
              {p.qty} {unitLabel(p.unit)}
            </span>
            <button type="button" className={styles.step} aria-label={t("fridge.more")} onClick={() => changeQty(p.id, 1)}>
              +
            </button>
          </div>
        ))}
        {visible.length === 0 && (
          <p className={styles.empty}>
            {homeProducts.length === 0 ? t("fridge.emptyHome") : t("fridge.notFound")}
          </p>
        )}
      </Card>

      <Fab to={`/more/fridge/add?home=${home.id}`} label={t("fridge.add")} text={t("fridge.product")} />
    </Page>
  );
}

export default Fridge;
