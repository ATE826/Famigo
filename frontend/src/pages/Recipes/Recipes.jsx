import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../../components/Card/Card";
import Chip, { ChipRow } from "../../components/Chip/Chip";
import Icon from "../../components/Icon/Icon";
import Paywall from "../../components/Paywall/Paywall";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Switch from "../../components/Switch/Switch";
import { t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { copyText } from "../../utils/clipboard";
import { homeOf } from "../../utils/homes";
import AiSuggest from "./AiSuggest";
import { evaluate, recipes } from "./recipes";
import styles from "./Recipes.module.css";

const FILTERS = ["all", "ready", "buy"];

function Recipes() {
  const { homes, products, members, currentUserId, plan } = useData();
  const [params] = useSearchParams();
  const [homeId, setHomeId] = useState(
    () => homes.find((h) => h.id === params.get("home"))?.id ?? homeOf(homes, currentUserId)?.id ?? homes[0]?.id,
  );
  const [filter, setFilter] = useState("all");
  const [allMembers, setAllMembers] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => members.map((member) => member.id));
  const [copied, setCopied] = useState("");
  const selectedMembers = allMembers ? members : members.filter((member) => selectedIds.includes(member.id));
  const memberIds = selectedMembers.map((member) => member.id);

  function toggleMember(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  const results = recipes
    .map((recipe) => evaluate(recipe, products.filter((p) => p.homeId === homeId), selectedMembers))
    .filter((r) => r.have.length > 0)
    .filter((r) => (filter === "ready" ? r.missing.length === 0 : filter === "buy" ? r.missing.length > 0 : true))
    .filter((r) => r.blocked.length === 0)
    .sort((a, b) => a.missing.length - b.missing.length || a.blocked.length - b.blocked.length);

  async function copyList(result) {
    const lines = result.missing.map((i) => `— ${i.name}`).join("\n");
    if (await copyText(`${t("recipes.listTitle", { dish: result.recipe.title })}\n${lines}`)) {
      setCopied(result.recipe.id);
      setTimeout(() => setCopied(""), 1800);
    }
  }

  return (
    <Page>
      <PageHeader title={t("recipes.title")} subtitle={t("recipes.subtitle")} to="/more/fridge" />

      {!plan.recipes ? (
        <Paywall
          title={t("recipes.lockedTitle")}
          text={t("recipes.lockedText")}
          cta={t("recipes.lockedCta")}
          reason="recipes"
        />
      ) : (
        <>
          {homes.length > 1 && (
            <ChipRow aria-label={t("fridge.home")}>
              {homes.map((h) => (
                <Chip key={h.id} active={h.id === homeId} onClick={() => setHomeId(h.id)}>
                  {h.name}
                </Chip>
              ))}
            </ChipRow>
          )}

          <section className={styles.preferences} aria-label={t("recipes.forWhom")}>
            <h2 className={styles.preferencesTitle}>{t("recipes.forWhom")}</h2>
            <label className={styles.preferenceToggle}>
              <span className={styles.fitText}>
                <span className={styles.fitTitle}>{t("recipes.onlyFit")}</span>
                <span className={styles.fitHint}>{t("recipes.onlyFitHint")}</span>
              </span>
              <Switch checked={allMembers} onChange={(event) => setAllMembers(event.target.checked)} />
            </label>
            {!allMembers && (
              <div className={styles.eaters}>
                <span>{t("recipes.selectedPeople")}</span>
                <ChipRow aria-label={t("recipes.selectedPeople")}>
                  {members.map((member) => (
                    <Chip key={member.id} active={selectedIds.includes(member.id)}
                      aria-pressed={selectedIds.includes(member.id)} onClick={() => toggleMember(member.id)}>
                      {member.name}
                    </Chip>
                  ))}
                </ChipRow>
                <p className={styles.aiText}>{t(memberIds.length ? "recipes.selectionHint" : "recipes.noPeopleHint")}</p>
              </div>
            )}
          </section>

          {homeId && <AiSuggest homeId={homeId} allMembers={allMembers} memberIds={memberIds} />}

          <h2 className={styles.section}>{t("recipes.catalog")}</h2>

          <ChipRow>
            {FILTERS.map((f) => (
              <Chip key={f} active={f === filter} onClick={() => setFilter(f)}>
                {t(`recipes.filters.${f}`)}
              </Chip>
            ))}
          </ChipRow>

          {results.length === 0 && (
            <div className={styles.empty}>
              <b>{t("recipes.empty")}</b>
              <span>{t("recipes.emptyHint")}</span>
            </div>
          )}

          {results.map((result) => (
            <Card key={result.recipe.id} className={styles.dish}>
              <div className={styles.dishHead}>
                <h2 className={styles.dishTitle}>{result.recipe.title}</h2>
                <span className={styles.time}>{t("recipes.minutes", { count: result.recipe.minutes })}</span>
              </div>

              <div className={styles.badges}>
                {result.missing.length === 0 ? (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>{t("recipes.ready")}</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>
                    {t("recipes.missing", { count: result.missing.length })}
                  </span>
                )}
                {result.blocked.length === 0 ? (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>
                    {t(allMembers ? "recipes.fitAll" : memberIds.length ? "recipes.fitSelected" : "recipes.noRestrictions")}
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeWarn}`}>
                    {t("recipes.notFit", { names: result.blocked.map((m) => m.name).join(", ") })}
                  </span>
                )}
              </div>

              <ul className={styles.ingredients}>
                {result.have.map((i) => (
                  <li key={i.name} className={styles.have}>
                    <Icon name="check" size={14} strokeWidth={2.4} />
                    {i.name}
                  </li>
                ))}
                {result.missing.map((i) => (
                  <li key={i.name} className={styles.need}>
                    <Icon name="cart" size={14} strokeWidth={2} />
                    {i.name}
                  </li>
                ))}
              </ul>

              <details className={styles.steps}>
                <summary>{t("recipes.steps")}</summary>
                <ol>
                  {result.recipe.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>

              {result.missing.length > 0 && (
                <button type="button" className={styles.copy} onClick={() => copyList(result)}>
                  <Icon name={copied === result.recipe.id ? "check" : "cart"} size={16} strokeWidth={2} />
                  {copied === result.recipe.id ? t("recipes.copied") : t("recipes.copy")}
                </button>
              )}
            </Card>
          ))}

          <p className={styles.note}>{t("recipes.note")}</p>
        </>
      )}
    </Page>
  );
}

export default Recipes;
