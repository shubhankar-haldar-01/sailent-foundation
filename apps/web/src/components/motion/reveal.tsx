'use client';

import * as React from 'react';

import { cn } from '@sailent/ui';

/**
 * Fade-and-rise the first time this scrolls into view.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * VISIBLE BY DEFAULT. The server renders no `data-reveal` at all, so the
 * markup that reaches the browser is plain, finished content. Only once this
 * has mounted does it mark itself pending and start watching.
 *
 * That ordering is the entire safety argument. The usual way round — render
 * hidden, reveal with script — loses the content outright whenever the script
 * does not arrive: a failed chunk, a blocking extension, a phone that gave up
 * on the bundle. Here the worst case is that the animation does not happen.
 *
 * `useLayoutEffect` rather than `useEffect` so the pending state lands BEFORE
 * the browser paints; with `useEffect` anything already on screen flashes in
 * and then out again.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * It fires ONCE and disconnects. Content that re-animates every time it
 * crosses the viewport is the thing people turn animations off to escape.
 */

/** `useLayoutEffect` warns when it runs on the server; this picks the safe one. */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds, for staggering a row. Keep the total under ~400ms. */
  delay?: number;
  as?: 'div' | 'li' | 'section';
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [state, setState] = React.useState<'idle' | 'pending' | 'in'>('idle');

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Asked for no motion, or the browser is too old for the observer: leave it
    // visible and do nothing at all.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    setState('pending');

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState('in');
        observer.disconnect();
      },
      // A tenth of a viewport of overlap, so it starts as the band arrives
      // rather than the instant its top edge appears.
      { rootMargin: '0px 0px -10% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return React.createElement(
    Tag,
    {
      ref,
      className: cn('reveal', className),
      ...(state === 'idle' ? {} : { 'data-reveal': state }),
      ...(delay && state !== 'idle' ? { style: { transitionDelay: `${delay}ms` } } : {}),
    },
    children,
  );
}
