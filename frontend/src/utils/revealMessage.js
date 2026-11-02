/**
 * Bringing a message into view when it appears, so an error or confirmation shown at
 * the top of a long page or window is never left off screen when the person is
 * scrolled down to the button they pressed (often the case on phones).
 */

import { useEffect, useRef } from 'react';

/**
 * A ref for a message's element. Whenever the message changes to something, the
 * element is scrolled to the middle of the screen (without animation for people who
 * ask for reduced motion) and focused, so screen readers read it too. The element
 * needs tabIndex={-1} to take focus.
 */
export function useRevealMessage(message) {
  const ref = useRef(null);

  useEffect(() => {
    if (!message || (Array.isArray(message) && message.length === 0)) return;
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    el.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el.focus?.({ preventScroll: true });
  }, [message]);

  return ref;
}
