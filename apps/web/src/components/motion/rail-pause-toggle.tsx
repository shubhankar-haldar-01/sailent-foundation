import { cn } from '@sailent/ui';

import type { AutoplayRail } from './use-autoplay-rail';

/**
 * Pause/play for an autoplaying rail, HIDDEN UNTIL IT IS TABBED TO.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS WHEN NO BUTTON IS SHOWN.
 *
 * The visible pause buttons were taken off the homepage rails at the client's
 * request. The control itself cannot go: WCAG 2.2.2 (Level A) requires a way
 * to stop anything that moves on its own for more than five seconds, and hover
 * — the pointer's way of holding a rail — does nothing for a keyboard or a
 * screen reader. So it is in the page, announced by name, and it appears the
 * moment it has keyboard focus, like a skip link. A pointer never sees it.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Renders nothing when the rail cannot play — nothing to scroll to, or reduced
 * motion asked for — because then there is nothing to pause.
 *
 * Its padding and surface are applied only while focused: on the hidden state
 * they would give it a size even while it is clipped out of sight. The caller
 * places it with `className` (where it should appear when shown), inside a
 * `relative` ancestor.
 */
export function RailPauseToggle({
  rail,
  label,
  className,
}: {
  rail: Pick<AutoplayRail, 'canPlay' | 'isPlaying' | 'toggle'>;
  /** What is moving, as it should be read out: "featured campaigns". */
  label: string;
  className?: string;
}) {
  if (!rail.canPlay) return null;

  return (
    <button
      type="button"
      onClick={rail.toggle}
      className={cn(
        'sr-only',
        'focus-visible:not-sr-only focus-visible:absolute focus-visible:z-10 focus-visible:whitespace-nowrap',
        'text-body-sm focus-visible:bg-surface font-semibold focus-visible:rounded-full focus-visible:px-4 focus-visible:py-2 focus-visible:shadow-md',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
    >
      {rail.isPlaying ? `Pause ${label}` : `Play ${label}`}
    </button>
  );
}
