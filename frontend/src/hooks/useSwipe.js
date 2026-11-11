import { useEffect, useRef } from "react";

const SWIPE_DISTANCE = 60;
const TEXT_FIELDS = ["INPUT", "TEXTAREA", "SELECT"];

export default function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);
  const handlers = useRef({ onLeft, onRight });

  useEffect(() => {
    handlers.current = { onLeft, onRight };
  });

  useEffect(() => {
    function onKeyDown(e) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (TEXT_FIELDS.includes(document.activeElement?.tagName)) return;
      if (e.key === "ArrowRight") handlers.current.onLeft?.();
      else if (e.key === "ArrowLeft") handlers.current.onRight?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onTouchStart(e) {
    const touch = e.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(e) {
    if (!start.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.current.x;
    const dy = touch.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onLeft?.();
      else onRight?.();
    }
  }

  return { onTouchStart, onTouchEnd };
}
