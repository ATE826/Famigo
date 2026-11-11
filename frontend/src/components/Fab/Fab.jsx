import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon/Icon";
import styles from "./Fab.module.css";

const SCROLL_STEP = 6;

export default function Fab({ to, label, text }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
      if (nearBottom || y < lastY - SCROLL_STEP) setHidden(false);
      else if (y > lastY + SCROLL_STEP && y > 80) setHidden(true);
      if (Math.abs(y - lastY) > SCROLL_STEP) lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Link
      to={to}
      aria-label={label}
      className={`${styles.fab} ${text ? styles.wide : ""} ${hidden ? styles.hidden : ""}`}
    >
      <Icon name="plus" size={text ? 20 : 24} />
      {text}
    </Link>
  );
}
