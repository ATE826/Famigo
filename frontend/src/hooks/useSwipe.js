import { useRef } from "react";

const SWIPE_DISTANCE = 60;

export default function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);

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
