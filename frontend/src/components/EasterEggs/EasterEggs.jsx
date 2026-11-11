import { useEffect, useId, useRef, useState } from "react";
import { useData } from "../../store/DataContext";
import { t } from "../../i18n";
import Button from "../Button/Button";
import Icon from "../Icon/Icon";
import { EasterEggContext } from "./EasterEggContext";
import styles from "./EasterEggs.module.css";

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
const CAT_WORDS = new Set([":cat", ":кот", ":katze", ":gato", ":猫", ":ねこ"]);

export default function EasterEggs({ children }) {
  const { status, currentUserId } = useData();
  const enabled = status === "ready" || status === "noFamily";
  const [egg, setEgg] = useState(null);
  const [pets, setPets] = useState(0);
  const [owner, setOwner] = useState(currentUserId);
  const taps = useRef({ count: 0, at: 0 });
  const sequence = useRef({ count: 0, at: 0 });
  const previousFocus = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();

  if (owner !== currentUserId) {
    setOwner(currentUserId);
    setEgg(null);
    setPets(0);
  }

  function openEgg(kind) {
    if (!enabled) return;
    previousFocus.current = document.activeElement;
    setPets(0);
    setEgg(kind);
  }

  function closeEgg() {
    setEgg(null);
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
  }

  function tapLogo() {
    const now = Date.now();
    taps.current.count = now - taps.current.at < 1500 ? taps.current.count + 1 : 1;
    taps.current.at = now;
    if (taps.current.count === 5) { taps.current.count = 0; openEgg("council"); }
  }

  function searchCat(value) {
    if (!CAT_WORDS.has(value.trim().toLowerCase()) || !enabled) return false;
    openEgg("cat");
    return true;
  }

  useEffect(() => { if (egg && enabled) closeRef.current?.focus(); }, [egg, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    function reset() { sequence.current = { count: 0, at: 0 }; }
    function keydown(event) {
      if (event.key === "Escape" && egg) { closeEgg(); return; }
      if (egg || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing
        || event.target.closest?.("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox'], [role='dialog'], dialog")) { reset(); return; }
      const now = Date.now();
      const count = now - sequence.current.at < 3000 ? sequence.current.count : 0;
      const next = event.code === KONAMI[count] ? count + 1 : event.code === KONAMI[0] ? 1 : 0;
      sequence.current = { count: next, at: now };
      if (next === KONAMI.length) {
        previousFocus.current = document.activeElement;
        setPets(0); setEgg("level"); reset();
      }
    }
    window.addEventListener("keydown", keydown);
    window.addEventListener("blur", reset);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("blur", reset); reset(); };
  }, [enabled, egg]);

  return (
    <EasterEggContext.Provider value={{ tapLogo, searchCat }}>
      {children}
      {enabled && egg && (
        <aside className={styles.surprise} aria-labelledby={titleId}>
          <button ref={closeRef} type="button" className={styles.close} onClick={closeEgg} aria-label={t("common.close")}>
            <Icon name="close" size={20} />
          </button>
          <div className={styles.art} aria-hidden="true">
            {egg === "cat" ? (
              <svg viewBox="0 0 80 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 29 13 7l19 12a35 35 0 0 1 16 0L67 7l-4 22c9 27-55 31-46 0Z" />
                <path d="m26 32 5 2-5 2m28-4-5 2 5 2M37 40l3 3 3-3m-3 3v5m-12-7L7 37m20 10L8 49m44-8 21-4M53 47l19 2" />
              </svg>
            ) : <Icon name={egg === "council" ? "home" : "star"} size={48} strokeWidth={1.5} />}
          </div>
          <h2 id={titleId}>{t(`easterEggs.${egg}.title`)}</h2>
          <p>{t(`easterEggs.${egg}.text`)}</p>
          {egg === "cat" && <>
            <Button onClick={() => setPets((n) => n + 1)}>{t("easterEggs.cat.pet")}</Button>
            <p className={styles.reward} aria-live="polite">{pets >= 3 ? t("easterEggs.cat.reward") : t("easterEggs.cat.count", { count: pets })}</p>
          </>}
        </aside>
      )}
    </EasterEggContext.Provider>
  );
}
