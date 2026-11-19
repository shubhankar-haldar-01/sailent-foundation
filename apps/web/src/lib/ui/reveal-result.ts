'use client';

import * as React from 'react';

/**
 * Bring a save's result into view, and put focus on it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE OWNER'S RULE (2026-11-19): AFTER SAVING ANYTHING, THE PAGE GOES TO THE
 * MESSAGE.
 *
 * A "Saved." or an error banner the person cannot see is no answer at all: on
 * a long form it appears at the top while they are looking at the button at
 * the bottom, and they press it again. So every save-result message on the
 * site uses `useRevealResult`: when a new result appears, the page scrolls to
 * it (only if it is not already fully in view, so nothing jumps needlessly)
 * and focus moves onto it, so a keyboard or screen-reader user is taken there
 * too and carries on from it.
 *
 * Only after the person has DONE something on the page (pressed a key,
 * clicked, submitted). A message present when the page loads never steals
 * focus. Smooth scrolling gives way to an instant jump for anyone who has
 * asked for reduced motion.
 *
 * Sign-in forms do not use it: after a mistyped password the cursor belongs
 * in the password field, not on the message.
 * ══════════════════════════════════════════════════════════════════════════
 */

let interacted = false;

if (typeof window !== 'undefined') {
  const mark = () => {
    interacted = true;
  };
  for (const type of ['pointerdown', 'keydown', 'submit'] as const) {
    window.addEventListener(type, mark, { capture: true, passive: true });
  }
}

/** Room left for the sticky site and admin headers when deciding what is "in view". */
const HEADER_CLEARANCE = 96;

export function revealResult(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const inView = rect.top >= HEADER_CLEARANCE && rect.bottom <= window.innerHeight - 8;
  if (!inView && typeof element.scrollIntoView === 'function') {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
  // Focusable by script only: it is a message, not a control to tab to.
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
}

/**
 * A ref for a save-result message. Each time `result` changes (a new action
 * state, a new message) and the element is on the page, it is revealed.
 */
export function useRevealResult<T extends HTMLElement = HTMLDivElement>(result: unknown) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element || !interacted) return;
    revealResult(element);
  }, [result]);
  return ref;
}

/** For tests: behave as if the person has already used the page. */
export function markInteractedForTests(): void {
  interacted = true;
}
