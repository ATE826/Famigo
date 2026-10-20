import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { LANGUAGES, t } from "../../i18n";
import { useLanguage } from "../../i18n/LanguageContext";
import styles from "./Language.module.css";

function Language() {
  const { lang, setLang } = useLanguage();

  return (
    <Page>
      <PageHeader title={t("settings.language")} to="/settings" />
      <p className={styles.intro}>{t("settings.languageIntro")}</p>

      <Card flush role="radiogroup" aria-label={t("settings.language")}>
        {LANGUAGES.map((l) => {
          const active = l.value === lang;
          const name = t(`settings.languages.${l.value}`);
          return (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={active}
              lang={l.value}
              className={`${styles.row} ${active ? styles.active : ""}`}
              onClick={() => setLang(l.value)}
            >
              <span className={styles.text}>
                <span className={styles.label}>{l.label}</span>
                {name !== l.label && <span className={styles.sub}>{name}</span>}
              </span>
              {active && <Icon name="check" size={20} strokeWidth={2.2} className={styles.check} />}
            </button>
          );
        })}
      </Card>
    </Page>
  );
}

export default Language;
