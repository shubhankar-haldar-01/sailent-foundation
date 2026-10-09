'use client';

import { ArrowUp } from 'lucide-react';

import { cn } from '@sailent/ui';

/**
 * Back to top — the round button at the foot of the mobile footer.
 *
 * Scrolls smoothly unless the reader has asked for reduced motion. When it is
 * pressed from the keyboard (a click with `detail === 0`), focus moves to the
 * skip link, the first stop on every page, so the keyboard position follows
 * the scroll instead of staying at the bottom of the page.
 */
export function BackToTop({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        if (event.detail === 0) {
          document.querySelector<HTMLElement>('.skip-link')?.focus({ preventScroll: true });
        }
      }}
      className={cn(
        'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:outline-ring grid size-14 shrink-0 place-items-center rounded-full shadow-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      <ArrowUp className="size-6" strokeWidth={2.4} aria-hidden="true" />
      <span className="sr-only">Back to top</span>
    </button>
  );
}
