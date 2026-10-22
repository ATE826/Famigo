import { documents } from "../../legal/documents";
import { DOCUMENT_DATE, OPERATOR } from "../../legal/operator";
import { getLang, t } from "../../i18n";
import styles from "./LegalDocument.module.css";

function fill(text) {
  return text.replace(/\{(\w+)\}/g, (match, key) => OPERATOR[key] ?? match);
}

export default function LegalDocument({ id, showTitle = true }) {
  const document = documents[id];
  if (!document) return null;

  return (
    <article>
      {showTitle && <h1 className={styles.title}>{document.title}</h1>}
      <p className={styles.meta}>{t("legal.updated", { date: DOCUMENT_DATE })}</p>
      {getLang() !== "ru" && <p className={styles.note}>{t("legal.russianOnly")}</p>}

      {document.sections.map((section, index) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.heading}>
            {index + 1}. {section.title}
          </h2>
          {section.items.map((item, i) =>
            Array.isArray(item) ? (
              <ul key={i} className={styles.list}>
                {item.map((line) => (
                  <li key={line}>{fill(line)}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className={styles.text}>
                {fill(item)}
              </p>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
