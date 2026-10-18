import { Link } from "react-router-dom";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { homeGradient, homeIcon } from "../../utils/homes";
import { canManageHomes } from "../../utils/permissions";
import { peopleLabel, roomsLabel } from "../../utils/plural";
import styles from "./Homes.module.css";

function Homes() {
  const { homes, members, currentUserId } = useData();
  const canManage = canManageHomes(members.find((m) => m.id === currentUserId));

  return (
    <Page>
      <PageHeader
        title="Дома"
        to="/more"
        right={
          canManage && (
            <Link to="/more/homes/add" className={styles.add} aria-label="Добавить дом">
              <Icon name="plus" size={20} />
            </Link>
          )
        }
      />

      {homes.map((h) => (
        <Link key={h.id} to={`/more/home/${h.id}`} className={styles.card}>
          <div className={styles.hero} style={{ background: homeGradient(h.kind) }}>
            <Icon name={homeIcon(h.kind)} size={52} strokeWidth={1.2} />
          </div>
          <div className={styles.info}>
            <h2 className={styles.name}>{h.name}</h2>
            <span className={styles.place}>{h.place}</span>
            <div className={styles.tags}>
              <span className={styles.tagGreen}>{roomsLabel(h.rooms)}</span>
              <span className={styles.tagGray}>{peopleLabel(h.people)}</span>
            </div>
          </div>
        </Link>
      ))}
    </Page>
  );
}

export default Homes;
