import { useEffect, useId, useState } from "react";
import Button from "../../components/Button/Button";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Select from "../../components/Select/Select";
import { errorText } from "../../api/client";
import { getLang, t } from "../../i18n";
import { useData } from "../../store/DataContext";
import { copyText } from "../../utils/clipboard";
import styles from "./Recipes.module.css";

// Последний запрос по дому, языку и выбранным ограничениям. Хранится вне компонента:
// если уйти со страницы во время генерации и вернуться, ответ не потеряется.
const runs = new Map();
const CATEGORIES = ["any", "snack", "hot", "cold", "soup", "salad", "bakery", "dessert", "drink"];

// Записи не меняются, а заменяются новыми: React (и его компилятор) видит изменения по ссылке.
function startRun(homeId, category, request) {
  const run = { pending: true, result: null, error: null, promise: null, category };
  const settle = (done) => {
    const next = { ...done, category };
    if (runs.get(homeId) === run) runs.set(homeId, next);
    return next;
  };
  run.promise = request.then(
    (result) => settle({ pending: false, result, error: null }),
    (error) => settle({ pending: false, result: null, error }),
  );
  runs.set(homeId, run);
  return run;
}

export default function AiSuggest({ homeId, allMembers = true, memberIds = [] }) {
  const { members, suggestRecipes } = useData();
  const categoryId = useId();
  const selectedMembers = allMembers ? members : members.filter((member) => memberIds.includes(member.id));
  const profileKey = JSON.stringify(selectedMembers.map((member) => [member.id, member.foodPrefs, member.foodNote]).sort());
  const runKey = `${homeId}:${getLang()}:${allMembers}:${profileKey}`;
  const [category, setCategory] = useState(() => runs.get(runKey)?.category ?? "any");
  const [servings, setServings] = useState(() => Math.min(Math.max(members.length, 1), 12));
  const [run, setRun] = useState(() => runs.get(runKey) ?? null);
  const [copied, setCopied] = useState(-1);

  // Сменили дом, язык или ограничения — показываем соответствующий последний результат.
  const [shownHome, setShownHome] = useState(runKey);
  if (shownHome !== runKey) {
    setShownHome(runKey);
    setRun(runs.get(runKey) ?? null);
    setCategory(runs.get(runKey)?.category ?? category);
  }

  useEffect(() => {
    if (!run?.pending) return undefined;
    let alive = true;
    run.promise.then((done) => alive && setRun(done));
    return () => {
      alive = false;
    };
  }, [run]);

  function generate() {
    setCopied(-1);
    setRun(startRun(runKey, category, suggestRecipes(homeId, { servings, memberIds: allMembers ? [] : memberIds, allMembers, category })));
  }

  async function copyList(dish, index) {
    const lines = dish.ingredients
      .filter((i) => !i.inFridge && !i.staple)
      .map((i) => `— ${i.name}${i.amount ? ` (${i.amount})` : ""}`)
      .join("\n");
    if (await copyText(`${t("recipes.listTitle", { dish: dish.title })}\n${lines}`)) {
      setCopied(index);
      setTimeout(() => setCopied(-1), 1800);
    }
  }

  const loading = run?.pending ?? false;
  const result = run?.result;
  const items = [...(result?.items ?? [])].sort((a, b) => a.missingCount - b.missingCount);

  return (
    <>
      <Card className={styles.ai} aria-busy={loading}>
        <div className={styles.aiHead}>
          <Icon name="star" size={20} />
          <h2 className={styles.aiTitle}>{t("recipes.ai.title")}</h2>
        </div>
        <p className={styles.aiText}>{t("recipes.ai.text")}</p>

        <div className={styles.generationControls}>
          <Select
            id={categoryId}
            label={t("recipes.ai.category")}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={loading}
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`recipes.ai.categories.${value}`)}
              </option>
            ))}
          </Select>
          <div className={styles.servings}>
            <span>{t("recipes.ai.servings")}</span>
            <div className={styles.stepper} role="group" aria-label={t("recipes.ai.servings")}>
              <button
                type="button"
                aria-label={t("recipes.ai.less")}
                disabled={servings <= 1 || loading}
                onClick={() => setServings((n) => n - 1)}
              >
                <Icon name="minus" size={18} />
              </button>
              <b aria-live="polite">{servings}</b>
              <button
                type="button"
                aria-label={t("recipes.ai.more")}
                disabled={servings >= 12 || loading}
                onClick={() => setServings((n) => n + 1)}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>
          </div>
        </div>

        <Button onClick={generate} disabled={loading}>
          {loading ? t("recipes.ai.loading") : result ? t("recipes.ai.again") : t("recipes.ai.start")}
        </Button>
        {loading && <p className={styles.aiText} role="status">{t("recipes.ai.wait")}</p>}
        {run?.error && (
          <p className={styles.aiError} role="alert">
            {run.error.code === "ai_incomplete" ? t("recipes.ai.incomplete") : errorText(run.error)}
          </p>
        )}
      </Card>

      {result && items.length > 0 && (
        <div className={styles.selection} role="status">
          <h2>{t("recipes.ai.resultTitle")}</h2>
          <span>{t(`recipes.ai.categories.${result.category ?? "any"}`)}</span>
        </div>
      )}

      {result && items.length === 0 && (
        <div className={styles.empty}>
          <b>{t("recipes.ai.none")}</b>
          <span>{t("recipes.ai.noneHint")}</span>
        </div>
      )}

      {items.map((dish, index) => (
        <Card key={`${dish.title}-${index}`} className={styles.dish}>
          <div className={styles.dishHead}>
            <h3 className={styles.dishTitle}>{dish.title}</h3>
            {dish.minutes > 0 && <span className={styles.time}>{t("recipes.minutes", { count: dish.minutes })}</span>}
          </div>

          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles.badgeOk}`}>{t("recipes.ai.portions", { count: dish.servings })}</span>
            {dish.missingCount === 0 ? (
              <span className={`${styles.badge} ${styles.badgeOk}`}>{t("recipes.ready")}</span>
            ) : (
              <span className={`${styles.badge} ${styles.badgeWarn}`}>
                {t("recipes.missing", { count: dish.missingCount })}
              </span>
            )}
          </div>

          <ul className={styles.ingredients}>
            {dish.ingredients.map((i, n) => (
              <li key={`${i.name}-${n}`} className={i.inFridge || i.staple ? styles.have : styles.need}
                title={i.staple ? t("recipes.staple") : undefined}>
                <Icon name={i.inFridge || i.staple ? "check" : "cart"} size={14} strokeWidth={i.inFridge || i.staple ? 2.4 : 2} />
                {i.name}
                {i.amount && <span className={styles.amount}>{` ${i.amount}`}</span>}
              </li>
            ))}
          </ul>

          <details className={styles.steps}>
            <summary>{t("recipes.steps")}</summary>
            <ol>
              {dish.steps.map((step, n) => (
                <li key={n}>{step}</li>
              ))}
            </ol>
          </details>

          {dish.missingCount > 0 && (
            <button type="button" className={styles.copy} onClick={() => copyList(dish, index)}>
              <Icon name={copied === index ? "check" : "cart"} size={16} strokeWidth={2} />
              {copied === index ? t("recipes.copied") : t("recipes.copy")}
            </button>
          )}
        </Card>
      ))}

      {result && (
        <p className={styles.note}>
          {t("recipes.ai.disclaimer", { model: result.model })}
        </p>
      )}
    </>
  );
}
