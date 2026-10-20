import { Link } from "react-router-dom";
import Card from "../../components/Card/Card";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { plural } from "../../utils/plural";
import { roleLabels } from "../../utils/roles";
import styles from "./Family.module.css";

function Family() {
  const { members, familyName } = useData();

  return (
    <Page>
      <PageHeader title="Моя семья" to="/more" />
      <p className={styles.subtitle}>
        {familyName}, {members.length} {plural(members.length, ["участник", "участника", "участников"])}
      </p>

      <Link to="/more/invite" className={styles.invite}>
        <Icon name="plus" size={18} />
        Пригласить участника
      </Link>

      <Card flush>
        {members.map((m) => (
          <Link key={m.id} to={`/more/family/${m.id}`} className={styles.row}>
            <Avatar letter={m.letter} tone={m.tone} photo={m.photo} size={48} />
            <div className={styles.text}>
              <span className={styles.name}>{m.name}</span>
              <span className={styles.note}>{m.note}</span>
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
