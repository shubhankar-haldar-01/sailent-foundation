'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin bar at the top of the page while the next page loads (2026-11-19,
 * docs/ui-feedback.md).
 *
 * The App Router has no "navigation started" event, so the start is taken
 * from the thing that starts one: a click on a link to another page of this
 * site. The bar finishes when the path or query actually changes, and gives
 * up after 10 seconds so it can never hang. `startProgress()` and
 * `doneProgress()` drive it for a slow fetch that is not a navigation.
 *
 * It only appears if loading takes more than 150ms, so a quick page shows
 * nothing. Reduced motion: no creeping width, just a still bar.
 */

type Listener = (running: boolean) => void;
const listeners = new Set<Listener>();
export function startProgress() {
  for (const listener of listeners) listener(true);
}
export function doneProgress() {
  for (const listener of listeners) listener(false);
}

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [running, setRunning] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const listener: Listener = (next) => setRunning(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // A route change completes the bar.
  React.useEffect(() => {
    setRunning(false);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // A route handler (a CSV export, a receipt) answers with a file, not a page:
      // there is no route change to finish the bar.
      if (url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      setRunning(true);
    };
    // Bubble phase: a guard that cancels the click (unsaved changes) runs first.
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  React.useEffect(() => {
    if (!running) {
      setVisible(false);
      return;
    }
    const show = setTimeout(() => setVisible(true), 150);
    const giveUp = setTimeout(() => setRunning(false), 10_000);
    return () => {
      clearTimeout(show);
      clearTimeout(giveUp);
    };
  }, [running]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="z-(--z-banner) pointer-events-none fixed inset-x-0 top-0 h-0.5"
    >
      <div className="bg-primary h-full w-full origin-left animate-[sailent-progress_8s_cubic-bezier(0.1,0.7,0.2,1)_forwards] motion-reduce:w-full motion-reduce:animate-none" />
      <style>{`@keyframes sailent-progress { from { transform: scaleX(0.05); } to { transform: scaleX(0.9); } }`}</style>
    </div>
  );
}

/** Wrapped in Suspense: `useSearchParams` must be, or the page renders on the client only. */
export function TopProgressBar() {
  return (
    <React.Suspense fallback={null}>
      <ProgressBarInner />
    </React.Suspense>
  );
}
