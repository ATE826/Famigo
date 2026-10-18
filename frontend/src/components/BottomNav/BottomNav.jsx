import { NavLink, useLocation } from "react-router-dom";
import styles from "./BottomNav.module.css";

const items = [
  { to: "/main", label: "Главная", d: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { to: "/budget", label: "Бюджет", d: "M3 7h16a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M17 14h.01" },
  { to: "/calendar", label: "Календарь", d: "M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zM3 10h18M8 3v4M16 3v4" },
  { to: "/chats", label: "Чаты", d: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" },
  { to: "/more", label: "Ещё", d: "M4 6h16M4 12h16M4 18h16" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const activeIndex = items.findIndex(
    (item) => pathname === item.to || pathname.startsWith(item.to + "/"),
  );

  return (
    <nav className={styles.nav} aria-label="Основная навигация">
      <span
        className={`${styles.indicator} ${activeIndex === -1 ? styles.hidden : ""}`}
        style={{ "--i": Math.max(activeIndex, 0) }}
        aria-hidden="true"
      />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `${styles.item} ${isActive ? styles.active : ""}`
          }
        >
          <span className={styles.pill}>
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
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
