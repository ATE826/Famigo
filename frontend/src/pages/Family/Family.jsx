import { Link } from "react-router-dom";
import Card from "../../components/Card/Card";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { memberNote } from "../../utils/members";
import { roleLabels } from "../../utils/roles";
import { t } from "../../i18n";
import styles from "./Family.module.css";

function Family() {
  const { members, familyName, currentUserId } = useData();

  return (
    <Page>
      <PageHeader title={t("family.title")} to="/more" />
      <p className={styles.subtitle}>
        {familyName}, {t("plural.members", { count: members.length })}
      </p>

      <Link to="/more/invite" className={styles.invite}>
        <Icon name="plus" size={18} />
        {t("family.invite")}
      </Link>

      <Card flush>
        {members.map((m) => (
          <Link key={m.id} to={`/more/family/${m.id}`} className={styles.row}>
            <Avatar letter={m.letter} tone={m.tone} photo={m.photo} size={48} />
            <div className={styles.text}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.note}>{memberNote(m, currentUserId)}</span>
            </div>
            <span className={`${styles.role} ${styles[m.role]}`}>{roleLabels[m.role]}</span>
            <Icon name="chevron" size={18} className={styles.chevron} />
          </Link>
        ))}
      </Card>
    </Page>
  );
}

export default Family;
