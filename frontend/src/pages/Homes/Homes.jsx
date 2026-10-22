import { Link } from "react-router-dom";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import { useData } from "../../store/DataContext";
import { homeIcon, homeStyle } from "../../utils/homes";
import { canManageHomes } from "../../utils/permissions";
import { peopleLabel, roomsLabel } from "../../utils/plural";
import { t } from "../../i18n";
import styles from "./Homes.module.css";

function Homes() {
  const { homes, members, currentUserId, plan } = useData();
  const atLimit = homes.length >= plan.homes;
  const canManage = canManageHomes(members.find((m) => m.id === currentUserId));

  return (
    <Page wide>
      <PageHeader
        title={t("homes.title")}
        to="/more"
        right={
          canManage && (
            <Link
              to={atLimit ? "/premium" : "/more/homes/add"}
              state={atLimit ? { reason: "homes" } : undefined}
              className={styles.add}
              aria-label={t("homes.add")}
            >
              <Icon name={atLimit ? "crown" : "plus"} size={20} />
            </Link>
          )
        }
      />

      {Number.isFinite(plan.homes) && (
        <p className={`${styles.limit} ${atLimit ? styles.limitReached : ""}`}>
          <span>{t("homes.limit", { plan: t(`premium.plans.${plan.id}.name`), used: homes.length, limit: plan.homes })}</span>
          {atLimit && plan.id !== "premiumPlus" && (
            <Link to="/premium" state={{ reason: "homes" }} className={styles.limitLink}>
              {t("homes.upgrade")}
            </Link>
          )}
        </p>
      )}

      <div className={styles.list}>
        {homes.map((h) => (
          <Link key={h.id} to={`/more/home/${h.id}`} className={styles.card}>
            <div className={styles.hero} style={homeStyle(h.kind)}>
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
      </div>
    </Page>
  );
}

export default Homes;
