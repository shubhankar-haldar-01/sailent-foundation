/**
 * The two-column grid a campaign page and the donation builder share.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * PLAIN STRINGS IN A PLAIN MODULE, ON PURPOSE.
 *
 * The builder is a client component, and the campaign page — a server
 * component — used to lay this grid out itself for a campaign without
 * products. Every campaign page renders the builder now (2026-10-16), but the
 * strings stay in a plain module: a constant exported from a `'use client'`
 * file reaches a server component as a client reference rather than as the
 * string, so any server side that needs them imports the real value from here.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THE RAIL IS STICKY, AND NEVER SCROLLS INSIDE ITSELF.
 *
 * `items-start` on the grid lets the rail be as tall as its own content, which
 * is what gives `sticky` room to travel; the rail then stops by itself at the
 * bottom of the grid. `top-24` clears the 72px header with a little air.
 *
 * There is no `max-h` and no inner scrollbar. `StickyRail` applies this class
 * and, when the column is taller than the window, moves `top` up by the
 * difference so the column pins by its bottom edge instead.
 */
export const donationColumns =
  'grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]';

// `gap`, not `space-y`: the phone-only children are `display: none` on a
// desktop, and `space-y` would still leave a margin after the card for them.
export const donationRail = 'min-w-0 flex flex-col gap-4 lg:sticky lg:top-24';
