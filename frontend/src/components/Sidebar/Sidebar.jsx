import { Link, useLocation } from "react-router-dom";
import { useData } from "../../store/DataContext";
import styles from "./Sidebar.module.css";
import { t } from "../../i18n";

const items = [
  { to: "/main", label: "main", match: ["/main"], d: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  {
    to: "/more/family",
    label: "family",
    match: ["/more/family", "/more/invite"],
    d: "M16 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-2a4 4 0 00-3-3.9M16 3.1a3.5 3.5 0 010 6.8",
  },
  { to: "/more/homes", label: "homes", match: ["/more/homes", "/more/home"], d: "M4 21V8l8-5 8 5v13M9 21v-6h6v6" },
  { to: "/more/fridge", label: "fridge", match: ["/more/fridge"], d: "M6 3h12v18H6zM6 10h12M9 6v1.5M9 13v3" },
  {
    to: "/budget",
    label: "budget",
    match: ["/budget"],
    d: "M3 7h16a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M17 14h.01",
  },
  {
    to: "/calendar",
    label: "calendar",
    match: ["/calendar"],
    d: "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4",
  },
  { to: "/chats", label: "chats", match: ["/chats"], d: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" },
  {
    to: "/settings",
    label: "settings",
    match: ["/settings", "/more"],
    d: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  },
];

function isActive(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { familyName, members } = useData();
  const activeItem = items.find((item) => isActive(pathname, item.match));

  return (
    <nav className={styles.sidebar} aria-label={t("nav.mainMenu")}>
      <Link to="/main" className={styles.brand}>
        <span className={styles.logo}>F</span>
        <span className={styles.brandName}>Famigo</span>
      </Link>

      <div className={styles.items}>
        {items.map((item) => {
          const active = item === activeItem;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`${styles.item} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={item.d} />
              </svg>
              {t(`nav.${item.label}`)}
            </Link>
          );
        })}
      </div>

      <Link to="/more/family" className={styles.family}>
        <span className={styles.familyName}>{familyName}</span>
        <span className={styles.familyCount}>
          {t("plural.members", { count: members.length })}
        </span>
      </Link>
    </nav>
  );
}
