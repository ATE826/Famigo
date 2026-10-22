import { useEffect, useRef, useState } from "react";

const MAX_ZOOM = 6;
const DRAG_THRESHOLD = 5;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function constrain(view, size, minK, world) {
  const k = clamp(view.k, minK, minK * MAX_ZOOM);
  return {
    k,
    x: clamp(view.x, size.width - world.width * k, 0),
    y: clamp(view.y, size.height - world.height * k, 0),
  };
}

export default function useMapView(world, initialCenter) {
  const [viewport, setViewport] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [userView, setUserView] = useState(null);
  const [animating, setAnimating] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef({ dragging: false, moved: false, pinchDistance: 0 });

  const ready = size.width > 0 && size.height > 0;
  const minK = ready ? Math.max(size.width / world.width, size.height / world.height) : 1;
  const k0 = minK * 1.6;
  const initial = {
    k: k0,
    x: size.width / 2 - initialCenter.x * k0,
    y: size.height / 2 - initialCenter.y * k0,
  };
  const view = ready ? constrain(userView ?? initial, size, minK, world) : null;

  const latest = useRef({ view, size, minK });
  useEffect(() => {
    latest.current = { view, size, minK };
  });

  useEffect(() => {
    if (!viewport) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewport]);

  function apply(next, animate) {
    const { size: s, minK: m } = latest.current;
    const constrained = constrain(next, s, m, world);
    latest.current.view = constrained;
    setAnimating(animate);
    setUserView(constrained);
  }

  function zoomAt(factor, cx, cy, animate) {
    const { view: v, minK: m } = latest.current;
    if (!v) return;
    const k = clamp(v.k * factor, m, m * MAX_ZOOM);
    apply({ k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }, animate);
  }

  useEffect(() => {
    if (!viewport) return undefined;
    function onWheel(e) {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top, false);
    }
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  function onPointerDown(e) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    gesture.current.moved = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(e) {
    const pointer = pointers.current.get(e.pointerId);
    const { view: v } = latest.current;
    if (!pointer || !v) return;

    if (pointers.current.size === 1) {
      if (!gesture.current.dragging) {
        if (Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy) < DRAG_THRESHOLD) return;
        gesture.current.dragging = true;
        gesture.current.moved = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      apply({ ...v, x: v.x + dx, y: v.y + dy }, false);
    } else if (pointers.current.size === 2) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinchDistance > 0) {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt(
          distance / gesture.current.pinchDistance,
          (a.x + b.x) / 2 - rect.left,
          (a.y + b.y) / 2 - rect.top,
          false,
        );
      }
      gesture.current.pinchDistance = distance;
      gesture.current.moved = true;
    }
  }

  function onPointerEnd(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinchDistance = 0;
    if (pointers.current.size === 0) gesture.current.dragging = false;
  }

  function onClickCapture(e) {
    if (gesture.current.moved) {
      e.stopPropagation();
      gesture.current.moved = false;
    }
  }

  function onDoubleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    zoomAt(1.8, e.clientX - rect.left, e.clientY - rect.top, true);
  }

  function zoomBy(factor) {
    const { size: s } = latest.current;
    zoomAt(factor, s.width / 2, s.height / 2, true);
  }

  function centerOn(point, { level = 2.4, offsetY = 0 } = {}) {
    const { view: v, size: s, minK: m } = latest.current;
    if (!v) return;
    const k = Math.max(v.k, m * level);
    apply({ k, x: s.width / 2 - point.x * k, y: s.height / 2 + offsetY - point.y * k }, true);
  }

  return {
    ref: setViewport,
    view,
    animating,
    zoomBy,
    centerOn,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
      onDoubleClick,
    },
  };
}
