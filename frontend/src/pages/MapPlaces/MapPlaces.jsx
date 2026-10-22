import { Link, Navigate } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Card from "../../components/Card/Card";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import PageHeader from "../../components/PageHeader/PageHeader";
import Switch from "../../components/Switch/Switch";
import useNow from "../../hooks/useNow";
import { getLocale, t } from "../../i18n";
import { places } from "../../store/locations";
import { useData } from "../../store/DataContext";
import { PLANS } from "../../utils/plans";
import styles from "./MapPlaces.module.css";

const DAY = 86400000;

function dayLabel(date) {
  const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / DAY);
  if (diff === 0) return t("notifications.today");
  if (diff === 1) return t("notifications.yesterday");
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "long" }).format(date);
}

function MapPlaces() {
  const { members, plan, placeEvents, watchedPlaces, watchPlace } = useData();
  const now = useNow();

  if (!plan.geo) return <Navigate to="/premium" state={{ reason: "geo" }} replace />;

  const since = now.getTime() - plan.historyDays * DAY;
  const events = placeEvents
    .filter((e) => new Date(e.at).getTime() >= since)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const groups = [];
  for (const event of events) {
    const label = dayLabel(new Date(event.at));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(event);
    else groups.push({ label, items: [event] });
  }
  const timeOf = (iso) => new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });

  return (
    <Page>
      <PageHeader title={t("places.title")} subtitle={t("places.subtitle")} to="/map" />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("places.watchTitle")}</h2>
        <Card flush>
          {Object.keys(places).map((id) => (
            <label key={id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{t(`map.places.${id}`)}</span>
                <span className={styles.rowHint}>{t("places.watchHint")}</span>
              </span>
              <Switch checked={Boolean(watchedPlaces[id])} onChange={(e) => watchPlace(id, e.target.checked)} />
            </label>
          ))}
        </Card>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("places.history")}</h2>
        <p className={styles.note}>{t("places.historyDays", { count: plan.historyDays })}</p>
        {groups.length === 0 && <p className={styles.empty}>{t("places.empty")}</p>}
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <h3 className={styles.day}>{group.label}</h3>
            <Card flush>
              {group.items.map((event) => {
                const member = members.find((m) => m.id === event.memberId);
                if (!member) return null;
                return (
                  <div key={event.id} className={styles.event}>
                    <Avatar letter={member.letter} tone={member.tone} photo={member.photo} size={40} />
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{member.name}</span>
                      <span className={styles.rowHint}>
                        {t(`places.${event.type}`)} · {t(`map.places.${event.place}`)}
                      </span>
                    </span>
                    {watchedPlaces[event.place] && <Icon name="bell" size={14} className={styles.bell} />}
                    <span className={styles.time}>{timeOf(event.at)}</span>
                  </div>
                );
              })}
            </Card>
          </div>
        ))}
        {plan.historyDays < PLANS.premiumPlus.historyDays && (
          <Link to="/premium" state={{ reason: "places" }} className={styles.upsell}>
            <Icon name="crown" size={18} strokeWidth={1.8} />
            <span>{t("places.upsell", { count: PLANS.premiumPlus.historyDays })}</span>
            <Icon name="chevron" size={16} />
          </Link>
        )}
      </section>
    </Page>
  );
}

export default MapPlaces;
