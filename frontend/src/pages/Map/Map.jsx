/* eslint-disable react-hooks/refs -- useMapView hands out pointer handlers that read refs only inside events */
import { useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import PageHeader from "../../components/PageHeader/PageHeader";
import SosButton from "../../components/SosButton/SosButton";
import Switch from "../../components/Switch/Switch";
import useMapView from "../../hooks/useMapView";
import { getLocale, t } from "../../i18n";
import { KM_PER_UNIT, MAP_HEIGHT, MAP_WIDTH, places, positionOf } from "../../store/locations";
import { useData } from "../../store/DataContext";
import MapArt from "./MapArt";
import useGeoSharing from "../../hooks/useGeoSharing";
import styles from "./Map.module.css";

const WORLD = { width: MAP_WIDTH, height: MAP_HEIGHT };
const POI_ICONS = { work: "work", school: "school", shop: "cart" };
const DESKTOP_QUERY = "(min-width: 1024px)";

function formatDistance(km) {
  const meters = km * 1000;
  if (meters < 100) return t("map.nearby");
  const locale = getLocale();
  const distance =
    meters < 1000
      ? new Intl.NumberFormat(locale, { style: "unit", unit: "meter", maximumFractionDigits: 0 }).format(
          Math.round(meters / 10) * 10,
        )
      : new Intl.NumberFormat(locale, {
          style: "unit",
          unit: "kilometer",
          maximumFractionDigits: 1,
        }).format(km);
  return t("map.away", { distance });
}

function formatUpdated(minutes) {
  if (minutes === 0) return t("map.justNow");
  return new Intl.RelativeTimeFormat(getLocale(), { numeric: "always" }).format(-minutes, "minute");
}

function Map() {
  const { members, homes, currentUserId, locations, sharing, plan } = useData();
  const locked = !plan.geo;
  const geo = useGeoSharing();
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(true);

  const people = members.map((member) => {
    const location = locations[member.id];
    const visible = Boolean(location) && sharing[member.id] !== false;
    return { member, location, visible, position: visible ? positionOf(location) : null };
  });
  const me = people.find((p) => p.member.id === currentUserId);
  const visiblePeople = people.filter((p) => p.visible);
  const center = me?.position ?? visiblePeople[0]?.position ?? { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };

  const map = useMapView(WORLD, center);

  const markers = Object.entries(places)
    .map(([id, place]) => {
      const home = place.kind === "home" ? homes.find((h) => h.id === place.homeId) : null;
      if (place.kind === "home" && !home) return null;
      return {
        id,
        x: place.x,
        y: place.y,
        icon: place.kind === "home" ? (id === "dacha" ? "cottage" : "apartment") : POI_ICONS[id],
        label: home?.name ?? t(`map.places.${id}`),
      };
    })
    .filter(Boolean);

  function placeLabel(location) {
    const marker = markers.find((m) => m.id === location.place);
    return marker?.label ?? t(`map.places.${location.place}`);
  }

  function distanceFromMe(person) {
    if (!me?.visible || !person.visible || person.member.id === currentUserId) return "";
    const km = Math.hypot(person.position.x - me.position.x, person.position.y - me.position.y) * KM_PER_UNIT;
    return formatDistance(km);
  }

  function select(person) {
    if (!person.visible) return;
    setSelectedId(person.member.id);
    const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;
    map.centerOn(person.position, { offsetY: isDesktop || !expanded ? 0 : -Math.round(window.innerHeight * 0.14) });
  }

  function locateMe() {
    if (!me?.visible) return;
    setSelectedId(null);
    map.centerOn(me.position, { level: 2.4 });
  }

  const view = map.view;

  return (
    <main className={styles.page}>
      <div className={styles.head}>
        <PageHeader title={t("nav.map")} subtitle={t("map.subtitle")} right={<SosButton />} />
      </div>

      <div className={`${styles.stage} ${locked ? styles.locked : ""}`} inert={locked}>
        <div className={styles.mapWrap}>
          <div
            ref={map.ref}
            className={styles.viewport}
            role="application"
            aria-label={t("map.region")}
            {...map.handlers}
          >
            {view && (
              <div
                className={`${styles.world} ${map.animating ? styles.animating : ""}`}
                style={{
                  width: MAP_WIDTH,
                  height: MAP_HEIGHT,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                }}
              >
                <MapArt />

                {markers.map((marker) => (
                  <span
                    key={marker.id}
                    className={styles.poi}
                    style={{ transform: `translate(${marker.x}px, ${marker.y}px) scale(${1 / view.k}) translate(-50%, -50%)` }}
                  >
                    <Icon name={marker.icon} size={14} strokeWidth={2} />
                    {marker.label}
                  </span>
                ))}

                {[...visiblePeople]
                  .sort((a, b) => Number(a.member.id === selectedId) - Number(b.member.id === selectedId))
                  .map((person) => {
                    const isSelected = person.member.id === selectedId;
                    const isMe = person.member.id === currentUserId;
                    return (
                      <button
                        key={person.member.id}
                        type="button"
                        className={`${styles.pin} ${isSelected ? styles.pinSelected : ""} ${isMe ? styles.pinMe : ""}`}
                        style={{
                          transform: `translate(${person.position.x}px, ${person.position.y}px) scale(${1 / view.k}) translate(-50%, -100%)`,
                        }}
                        aria-label={`${person.member.name}, ${placeLabel(person.location)}`}
                        aria-pressed={isSelected}
                        onClick={() => select(person)}
                      >
                        <span className={styles.bubble}>
                          <Avatar
                            letter={person.member.letter}
                            tone={person.member.tone}
                            photo={person.member.photo}
                            size={isSelected ? 52 : 44}
                          />
                        </span>
                        <span className={styles.tail} />
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          <div className={styles.controls}>
            <button type="button" className={styles.control} aria-label={t("map.zoomIn")} onClick={() => map.zoomBy(1.6)}>
              <Icon name="plus" size={20} />
            </button>
            <button type="button" className={styles.control} aria-label={t("map.zoomOut")} onClick={() => map.zoomBy(1 / 1.6)}>
              <Icon name="minus" size={20} />
            </button>
            <button
              type="button"
              className={styles.control}
              aria-label={t("map.locateMe")}
              disabled={!me?.visible}
              onClick={locateMe}
            >
              <Icon name="locate" size={20} />
            </button>
          </div>

          {me && !me.visible && (
            <div className={styles.banner} role="status">
              <Icon name="lock" size={16} />
              <span>{t("map.selfHidden")}</span>
              <button type="button" className={styles.bannerAction} onClick={() => geo.request(true)}>
                {t("map.turnOn")}
              </button>
            </div>
          )}
        </div>

        <aside className={`${styles.sheet} ${expanded ? "" : styles.sheetCollapsed}`}>
          <button
            type="button"
            className={styles.handle}
            aria-expanded={expanded}
            aria-label={t("map.toggleList")}
            onClick={() => setExpanded(!expanded)}
          >
            <span className={styles.grip} />
          </button>

          <div className={styles.sheetHead}>
            <h2 className={styles.sheetTitle}>{t("map.listTitle")}</h2>
            <span className={styles.sheetCount}>{t("plural.members", { count: members.length })}</span>
          </div>

          <ul className={styles.list}>
            {people.map((person) => {
              const { member, location } = person;
              const isMe = member.id === currentUserId;
              const isSelected = member.id === selectedId;
              const distance = distanceFromMe(person);
              return (
                <li key={member.id} className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`}>
                  <button
                    type="button"
                    className={styles.row}
                    disabled={!person.visible}
                    aria-pressed={isSelected}
                    onClick={() => select(person)}
                  >
                    <Avatar letter={member.letter} tone={member.tone} photo={member.photo} size={44} />
                    <span className={styles.text}>
                      <span className={styles.name}>
                        {member.name}
                        {isMe && <span className={styles.you}>{t("map.you")}</span>}
                      </span>
                      <span className={styles.sub}>
                        {person.visible
                          ? `${placeLabel(location)} · ${formatUpdated(location.updated)}`
                          : t("map.hidden")}
                      </span>
                    </span>
                    {person.visible && location.battery !== undefined && (
                      <span
                        className={`${styles.battery} ${location.battery <= 15 ? styles.batteryLow : ""}`}
                        title={t("map.battery", { percent: location.battery })}
                      >
                        <Icon name="battery" size={16} strokeWidth={1.8} />
                        {location.battery}%
                      </span>
                    )}
                    {distance && <span className={styles.distance}>{distance}</span>}
                    {!person.visible && <Icon name="lock" size={16} className={styles.lock} />}
                  </button>

                  {isSelected && !isMe && (
                    <div className={styles.actions}>
                      <Link to={`/chats/${member.id}`} className={styles.action}>
                        <Icon name="chat" size={18} strokeWidth={1.8} />
                        {t("map.write")}
                      </Link>
                      <Link to={`/more/family/${member.id}`} className={styles.action}>
                        <Icon name="user" size={18} strokeWidth={1.8} />
                        {t("map.profile")}
                      </Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <Link to="/map/places" className={styles.placesLink}>
            <Icon name="clock" size={18} strokeWidth={1.8} />
            <span>{t("map.placesLink")}</span>
            <Icon name="chevron" size={16} />
          </Link>

          <label className={styles.share}>
            <span className={styles.shareText}>
              <span className={styles.shareTitle}>{t("map.share")}</span>
              <span className={styles.shareHint}>{t("map.shareHint")}</span>
            </span>
            <Switch checked={geo.on} onChange={(e) => geo.request(e.target.checked)} />
          </label>
        </aside>
      </div>
      {locked && (
        <div className={styles.paywall}>
          <div className={styles.paywallCard}>
            <span className={styles.paywallIcon}>
              <Icon name="crown" size={26} strokeWidth={1.8} />
            </span>
            <h2 className={styles.paywallTitle}>{t("map.paywallTitle")}</h2>
            <p className={styles.paywallText}>{t("map.paywallText")}</p>
            <Link to="/premium" state={{ reason: "geo" }} className={styles.paywallCta}>
              {t("map.paywallCta")}
            </Link>
          </div>
        </div>
      )}
      {geo.dialog}
    </main>
  );
}

export default Map;
