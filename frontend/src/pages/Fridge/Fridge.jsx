import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Card from "../../components/Card/Card";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Fab from "../../components/Fab/Fab";
import NoHomes from "../../components/NoHomes/NoHomes";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { homeOf } from "../../utils/homes";
import { productsLabel } from "../../utils/plural";
import { categories, categoryLabel, expiryDate, productBadge, unitLabel } from "./products";
import { t } from "../../i18n";
import styles from "./Fridge.module.css";

const ALL = "all";
const filters = [ALL, ...categories];

function Fridge() {
  const { homes, products, fridgeHomeId, setFridgeHomeId, changeQty, currentUserId, plan } = useData();
  const [params] = useSearchParams();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");

  const lockedHome = homes.find((h) => h.id === params.get("home"));
  const home =
    lockedHome ??
    homes.find((h) => h.id === fridgeHomeId) ??
    homeOf(homes, currentUserId) ??
    homes[0];
  // home?.id, а не home.id: без домов home пуст, а React Compiler вычисляет такие выражения заранее.
  const homeProducts = products.filter((p) => p.homeId === home?.id);

  const visible = homeProducts.filter(
    (p) =>
      (category === ALL || p.cat === category) &&
      p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (!home) {
    return (
      <Page>
        <PageHeader title={t("fridge.title")} to="/more" />
        <NoHomes />
      </Page>
    );
  }

  return (
    <Page fab>
      <PageHeader
        title={t("fridge.title")}
        subtitle={`${home.name}, ${productsLabel(homeProducts.length)}`}
        to={lockedHome ? `/more/home/${home.id}` : "/more"}
      />

      <Link to={`/more/fridge/recipes?home=${home.id}`} className={styles.recipes}>
        <span className={styles.recipesIcon}>
          <Icon name="food" size={20} strokeWidth={1.8} />
        </span>
        <span className={styles.recipesText}>
          <span className={styles.recipesTitle}>{t("recipes.title")}</span>
          <span className={styles.recipesSub}>{t("recipes.subtitle")}</span>
        </span>
        {!plan.recipes && <Icon name="crown" size={18} strokeWidth={1.8} className={styles.recipesCrown} />}
        <Icon name="chevron" size={18} />
      </Link>

      {!lockedHome && homes.length > 1 && (
        <ChipRow aria-label={t("fridge.home")}>
          {homes.map((h) => (
            <Chip key={h.id} active={h.id === home.id} onClick={() => setFridgeHomeId(h.id)}>
              {h.name}
            </Chip>
          ))}
        </ChipRow>
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
        {visible.map((p) => {
          const badge = productBadge(p);
          const date = expiryDate(p);
          return (
            <div key={p.id} className={styles.row}>
              <Link to={`/more/fridge/${p.id}/edit`} className={styles.text} aria-label={t("fridge.edit", { name: p.name })}>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.badges}>
                  {badge && <span className={`${styles.exp} ${styles[badge.tone]}`}>{badge.text}</span>}
                  {badge?.text !== date && <span className={styles.date}>{date}</span>}
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
          );
        })}
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
