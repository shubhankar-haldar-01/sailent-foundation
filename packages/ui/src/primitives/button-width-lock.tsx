'use client';

import * as React from 'react';

/**
 * Keeps a button from shrinking while it is loading.
 *
 * Rendered inside every `Button` (an empty, hidden span), so `Button` itself
 * stays usable from server components. While idle it remembers the button's
 * width; while loading it holds that width as the button's minimum, so
 * "Save settings" turning into "Saving…" does not pull the layout in.
 */
export function ButtonWidthLock({ active }: { active: boolean }) {
  const marker = React.useRef<HTMLSpanElement>(null);
  const idleWidth = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    const button = marker.current?.parentElement;
    if (!button) return;
    if (!active) {
      button.style.minWidth = '';
      idleWidth.current = button.offsetWidth || null;
      return;
    }
    if (idleWidth.current) button.style.minWidth = `${idleWidth.current}px`;
  });

  return <span ref={marker} hidden />;
}
