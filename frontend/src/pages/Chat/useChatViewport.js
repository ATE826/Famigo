import {useLayoutEffect} from 'react';

// Keep scrolling inside the conversation instead of panning the entire document.
export default function useChatViewport(screenRef, messagesRef, followLatest) {
  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const viewport = window.visualViewport;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    let frame;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const screen = screenRef.current;
        if (!screen) return;
        document.body.style.overflow = media.matches ? 'hidden' : bodyOverflow;
        document.documentElement.style.overflow = media.matches ? 'hidden' : htmlOverflow;
        screen.style.setProperty('--chat-height', `${viewport?.height ?? window.innerHeight}px`);
        screen.style.setProperty('--chat-top', `${viewport?.offsetTop ?? 0}px`);
        if (followLatest.current && messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      });
    }
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, [screenRef, messagesRef, followLatest]);
}
