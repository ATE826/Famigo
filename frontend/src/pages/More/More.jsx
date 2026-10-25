import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "../../components/Card/Card";
import Avatar from "../../components/Avatar/Avatar";
import Icon from "../../components/Icon/Icon";
import Page from "../../components/Page/Page";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import styles from "./More.module.css";

function More() {
  const { homes, members, currentUserId, plan } = useData();
  const me = members.find((m) => m.id === currentUserId);
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const items = [
    { label: t("nav.family"), sub: t("more.familySub"), to: "/more/family", icon: "users" },
    { label: t("nav.homes"), sub: homes.map((h) => h.name).join(", "), to: "/more/homes", icon: "home" },
    { label: t("nav.gallery"), sub: t("more.gallerySub"), to: "/gallery", icon: "image" },
    { label: t("nav.map"), sub: t("more.mapSub"), to: "/map", icon: "pin" },
    { label: t("nav.fridge"), sub: t("more.fridgeSub"), to: "/more/fridge", icon: "fridge" },
    { label: t("nav.premium"), sub: t("premium.currentPlan", { plan: t(`premium.plans.${plan.id}.name`) }), to: "/premium", icon: "crown" },
    { label: t("nav.settings"), sub: t("more.settingsSub"), to: "/settings", icon: "settings" },
  ];

  return (
    <Page className={styles.page}>
      <h1 className={styles.title}>{t("nav.more")}</h1>

      <Link to="/profile" className={styles.link}>
        <Card className={styles.profile}>
          <Avatar letter={me?.letter ?? ""} tone={me?.tone} photo={me?.photo} size={56} />
          <div className={styles.profileText}>
            <span className={styles.name}>{me?.name}</span>
            <span className={styles.email}>{me?.email}</span>
          </div>
          <Icon name="chevron" size={20} className={styles.chevron} />
        </Card>
      </Link>

      <Card flush>
        {items.map((item) => (
          <Link key={item.to} to={item.to} className={styles.item}>
            <span className={styles.itemIcon}>
              <Icon name={item.icon} size={20} strokeWidth={1.8} />
            </span>
            <div className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
              <span className={styles.itemSub}>{item.sub}</span>
            </div>
            <Icon name="chevron" size={18} className={styles.chevron} />
          </Link>
        ))}
      </Card>

      {confirming ? (
        <div className={styles.confirm} role="alert">
          <p className={styles.confirmText}>{t("more.logoutConfirm")}</p>
          <div className={styles.confirmButtons}>
            <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className={styles.confirmAction}
              onClick={() => navigate("/", { replace: true })}
            >
              {t("more.logout")}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.logout} onClick={() => setConfirming(true)}>
          {t("more.logout")}
        </button>
      )}
    </Page>
  );
}

export default More;
