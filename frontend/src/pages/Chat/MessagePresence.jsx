import {useLayoutEffect, useRef, useState} from 'react';

// Loaded tombstones are hidden immediately; live deletions animate the whole row.
export default function MessagePresence({deleted, children}) {
  const [hidden, setHidden] = useState(deleted);
  const [initialContent] = useState(children);
  const root = useRef(null);
  useLayoutEffect(() => {
    if (!deleted || hidden) return;
    const node = root.current;
    let active = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = node?.animate?.([
      {height: `${node.getBoundingClientRect().height}px`, opacity: 1},
      {height: '0px', opacity: 0}
    ], {duration: reduced ? 0 : 220, easing: 'ease-out', fill: 'forwards'});
    const timer = animation ? null : setTimeout(() => setHidden(true), 0);
    animation?.finished.then(() => {if (active) setHidden(true);}).catch(() => {});
    return () => {active = false; animation?.cancel(); clearTimeout(timer);};
  }, [deleted, hidden]);
  if (hidden) return null;
  return <div ref={root} style={{display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflow: 'hidden'}}>{deleted ? initialContent : children}</div>;
}
