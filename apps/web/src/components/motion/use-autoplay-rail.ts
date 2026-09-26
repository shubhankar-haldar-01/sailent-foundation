'use client';

import * as React from 'react';

/**
 * Advance a scrolling row on a timer.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ROW IS A REAL SCROLLING LIST AND STAYS ONE.
 *
 * This drives `scrollBy` on an element that already scrolls by swipe, trackpad,
 * shift-wheel and arrow key. It is an addition to native scrolling, not a
 * replacement for it: with scripting off the row still works, it simply does
 * not move on its own.
 *
 * AUTOPLAY IS A HOSTILE DEFAULT AND HAS TO EARN ITS PLACE. Content that moves
 * under a reader is the most complained-about pattern on the web, so every one
 * of these is implemented rather than intended:
 *
 *   • WCAG 2.2.2 (Pause, Stop, Hide, Level A) requires a mechanism to stop
 *     anything that moves automatically for more than five seconds. The caller
 *     MUST render the returned toggle. That is why `isPlaying` and `toggle`
 *     are returned rather than kept private — the control is part of the
 *     contract, not an optional extra.
 *   • `prefers-reduced-motion` means it never starts. Not "starts and jumps":
 *     the timer does not run at all.
 *   • Hover and focus-within pause it, so it never moves out from under
 *     someone reading a card or tabbing through its links.
 *   • A real interaction — swipe, wheel, pointer, key — stops it for good. An
 *     autoplay that resumes after the user has taken control is worse than one
 *     that never ran. The toggle brings it back if they want it.
 *   • A hidden tab and an off-screen row both pause. Otherwise it races
 *     through while nobody is watching and you return to a random position,
 *     having spent battery to get there.
 *   • A row with nothing to scroll never starts, and reports `canPlay: false`
 *     so the caller can leave the control out entirely.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface AutoplayRail {
  /** Attach to the scrolling element. */
  ref: React.RefObject<HTMLUListElement | null>;
  /** Whether the timer is currently running. Drives the toggle's label. */
  isPlaying: boolean;
  /** False when nothing overflows, or when reduced motion is asked for. */
  canPlay: boolean;
  /** The user-facing pause/play control. */
  toggle: () => void;
  /** Move one card, looping at the end. Exposed so the arrows reuse it. */
  advance: (direction?: -1 | 1) => void;
  /** Called by the arrows: hands control to the user and stops the timer. */
  surrender: () => void;
}

export function useAutoplayRail(
  /** Number of items, so the hook re-measures when the list changes. */
  itemCount: number,
  { intervalMs = 5000 }: { intervalMs?: number } = {},
): AutoplayRail {
  const ref = React.useRef<HTMLUListElement>(null);

  // `wanted` is the user's stated preference; `canPlay` is whether it is
  // possible; the paused reasons below are transient. The timer runs only when
  // all three agree, which keeps "why isn't it moving" answerable.
  const [wanted, setWanted] = React.useState(true);
  const [canPlay, setCanPlay] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);

  /**
   * Scroll so the next card's leading edge meets the row's.
   *
   * Measured with `getBoundingClientRect`, not `offsetLeft`: the latter is
   * relative to the offset parent, which is not the scroller, so it silently
   * includes the row's own padding and lands a few pixels out. Snap points
   * would mask it here, but not everywhere this might be reused.
   */
  const advance = React.useCallback((direction: -1 | 1 = 1) => {
    const element = ref.current;
    if (!element) return;

    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
    const items = Array.from(element.children) as HTMLElement[];
    const edge = element.getBoundingClientRect().left;
    const offsets = items.map((item) => item.getBoundingClientRect().left - edge);

    if (direction === 1) {
      // Within a few pixels of the end: back to the start. The tolerance is
      // for sub-pixel layout, which otherwise leaves it stuck one frame short
      // and looping between the last two cards forever.
      if (element.scrollLeft + element.clientWidth >= element.scrollWidth - 4) {
        element.scrollTo({ left: 0, behavior });
        return;
      }
      const next = offsets.find((offset) => offset > 4);
      element.scrollBy({ left: next ?? element.clientWidth, behavior });
      return;
    }

    if (element.scrollLeft <= 4) {
      element.scrollTo({ left: element.scrollWidth, behavior });
      return;
    }
    // The last card still starting left of the edge — the one that scrolled
    // off most recently.
    const previous = [...offsets].reverse().find((offset) => offset < -4);
    element.scrollBy({ left: previous ?? -element.clientWidth, behavior });
  }, []);

  /** Whether there is anything to scroll, and whether motion is welcome. */
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const measure = () => {
      // A one-pixel allowance: a row that fits exactly can report a scrollWidth
      // a fraction over its clientWidth, and would otherwise autoplay by
      // scrolling nowhere.
      setCanPlay(!motion.matches && element.scrollWidth - element.clientWidth > 1);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    motion.addEventListener('change', measure);

    return () => {
      observer.disconnect();
      motion.removeEventListener('change', measure);
    };
  }, [itemCount]);

  /** Stop for good once the user takes the wheel. */
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const surrender = () => setWanted(false);

    // Input events, NOT `scroll`. This hook's own `scrollBy` fires `scroll`,
    // so listening for that would have the timer switch itself off on its
    // first tick.
    const events = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    for (const name of events) {
      element.addEventListener(name, surrender, { passive: true });
    }

    return () => {
      for (const name of events) element.removeEventListener(name, surrender);
    };
  }, []);

  /** A hidden tab and an off-screen row both count as not watching. */
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const onVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new IntersectionObserver(
      (entries) => setIsVisible(entries.some((entry) => entry.isIntersecting) && !document.hidden),
      { threshold: 0.4 },
    );
    observer.observe(element);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, []);

  /** Pause while hovered, and while focus is anywhere inside the row. */
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const hold = () => setIsHovered(true);
    const release = () => setIsHovered(false);

    // `focusin`/`focusout` rather than `focus`/`blur`: only the former bubble,
    // so these catch focus landing on a link INSIDE a card. Without it the row
    // scrolls away from the card someone is tabbing through.
    element.addEventListener('pointerenter', hold);
    element.addEventListener('pointerleave', release);
    element.addEventListener('focusin', hold);
    element.addEventListener('focusout', release);

    return () => {
      element.removeEventListener('pointerenter', hold);
      element.removeEventListener('pointerleave', release);
      element.removeEventListener('focusin', hold);
      element.removeEventListener('focusout', release);
    };
  }, []);

  const isPlaying = wanted && canPlay && !isHovered && isVisible;

  React.useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => advance(1), intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, intervalMs, advance]);

  return {
    ref,
    // What the CONTROL should say. It reads "playing" while merely paused by a
    // hover, because a button that flips to "Play" as the pointer crosses the
    // row would be unusable — it would change under the cursor on the way to
    // being clicked.
    isPlaying: wanted && canPlay,
    canPlay,
    toggle: () => setWanted((playing) => !playing),
    advance,
    surrender: () => setWanted(false),
  };
}
