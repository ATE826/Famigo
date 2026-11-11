import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ThemeContext } from "./ThemeContext";

const STORAGE_KEY = "famigo-theme-v2";
const THEMES = ["light", "dark", "system"];
const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TRANSITION_MS = 400;

function readTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(theme) {
  if (theme === "system") {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  }
  return theme;
}

const THEME_COLORS = { light: "#F5F3EE", dark: "#151713" };

function setRootTheme(theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  const timer = useRef(null);

  // Плавная смена: браузер делает снимок страницы до и после и плавно переходит
  // между ними (мягкое затухание), так что все цвета меняются одновременно. Если API недоступен
  // (старые браузеры), включаем обычные CSS-переходы на короткое время.
  function animateThemeChange(update) {
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(update);
      return;
    }

    const root = document.documentElement;
    root.classList.add("theme-transition");
    void root.offsetHeight;
    update();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS);
  }

  useEffect(() => {
    setRootTheme(theme);

    if (theme !== "system") return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => setRootTheme(theme);
    query.addEventListener("change", onSystemChange);
    return () => query.removeEventListener("change", onSystemChange);
  }, [theme]);

  function setTheme(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // хранилище недоступно: тема просто не запомнится
    }
    animateThemeChange(() => {
      flushSync(() => setThemeState(value));
      setRootTheme(value);
    });
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
