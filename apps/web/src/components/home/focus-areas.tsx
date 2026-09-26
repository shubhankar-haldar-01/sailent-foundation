'use client';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import {
  BookSolid,
  HeartPulseSolid,
  LeafSolid,
  PawSolid,
  PeopleSolid,
  ShieldSolid,
  UtensilsSolid,
} from '@/components/home/focus-icons';
import { focusAreas, type FocusArea } from '@/lib/mock/home';

/**
 * SOLID marks, not `lucide` outlines — see `focus-icons.tsx` for why this one
 * strip departs from the icon set the rest of the site uses.
 */
const ICONS = {
  book: BookSolid,
  heart: HeartPulseSolid,
  utensils: UtensilsSolid,
  shield: ShieldSolid,
  users: PeopleSolid,
  sprout: LeafSolid,
  paw: PawSolid,
} satisfies Record<FocusArea['icon'], typeof BookSolid>;

const WASHES = {
  blue: 'bg-wash-blue text-info-action',
  rose: 'bg-wash-rose text-destructive',
  amber: 'bg-wash-amber text-primary',
  violet: 'bg-wash-violet text-wash-violet-ink',
  pink: 'bg-wash-pink text-wash-pink-ink',
  mint: 'bg-wash-mint text-success',
} satisfies Record<FocusArea['wash'], string>;

/**
 * The seven areas of work, as a FILTER for the campaigns below.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THESE ARE BUTTONS, NOT LINKS, AND THAT IS A DELIBERATE DOWNGRADE.
 *
 * They used to navigate to `/campaigns?categorySlug=…`. Now they narrow the
 * campaigns band underneath without leaving the page, so a visitor can look
 * through three areas of work in three clicks and no page loads.
 *
 * A control that changes what is already on screen is a button. Making it a
 * link would promise a destination that no longer exists, and would put a URL
 * on the status bar that goes nowhere different. The cost is real — no
 * middle-click, no "open in new tab" — and it is paid back by "View all
 * campaigns", which carries the chosen area through to the full listing.
 *
 * Each is a TOGGLE. Pressing the selected one again clears the filter, because
 * otherwise the only way back to every campaign is a page reload — and nothing
 * on screen would tell you that.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Horizontally scrollable below `lg` rather than wrapped into a grid: seven
 * items stacked two-across on a phone is a screen and a half of chrome before
 * any content. `snap-x` makes the scroll land on whole cards, and the list
 * keeps real focus order so a keyboard tabs through them in sequence and the
 * browser scrolls each into view on its own.
 *
 * Each item carries a hairline on its left edge at `lg`, which is what draws
 * the dividers between the seven in the approved design. The first is
 * suppressed so the row does not open with a rule against the gutter.
 */
export function FocusAreas({
  selected,
  onSelect,
}: {
  /** The focus-area slug currently filtering the campaigns, or null for all. */
  selected?: string | null;
  onSelect?: (slug: string | null) => void;
}) {
  return (
    <section aria-labelledby="focus-areas-title" className="bg-surface border-border border-b">
      <PageShell className="py-5 lg:py-6">
        <h2 id="focus-areas-title" className="sr-only">
          What we work on — choose an area to filter the campaigns below
        </h2>

        <ul
          className={cn(
            'rail flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2',
            // The gutter is on the shell, so the scroll container needs its own
            // trailing space or the last card sits flush against the edge.
            '-mx-1 px-1',
            'lg:grid lg:grid-cols-7 lg:items-stretch lg:gap-0 lg:overflow-visible lg:pb-0',
          )}
        >
          {focusAreas.map((area) => {
            const Icon = ICONS[area.icon];
            const isSelected = selected === area.slug;

            return (
              <li
                key={area.slug}
                className="border-border min-w-32 flex-1 snap-start lg:h-full lg:min-w-0 lg:border-l lg:first:border-l-0"
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(isSelected ? null : area.slug)}
                  /*
                    `aria-pressed`, not `aria-current`. This is a toggle whose
                    state is on or off, not one item of a set marking where you
                    are — and a screen reader announces "pressed", which is
                    exactly what has happened.
                  */
                  aria-pressed={isSelected}
                  className={cn(
                    'group flex h-full w-full flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-center',
                    'duration-(--duration-base) ease-(--ease-out-soft) transition-colors',
                    'hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
                    // Selected state is a ring AND a tinted ground, not colour
                    // alone — the icon is already coloured, so colour cannot be
                    // what distinguishes chosen from not.
                    isSelected && 'bg-muted ring-info-action/45 ring-2 ring-inset',
                  )}
                >
                  <span
                    className={cn(
                      'hover-pop grid size-11 place-items-center rounded-full',
                      'group-hover:scale-110 motion-reduce:scale-100',
                      WASHES[area.wash],
                    )}
                  >
                    <Icon className="size-[1.6rem]" aria-hidden="true" />
                  </span>
                  {/* `text-balance` keeps a two-line title even rather than
                      leaving one word stranded; the tighter padding above is
                      what lets "Women Empowerment" stay on one line at `lg`,
                      so the row of seven is not ragged. */}
                  <span className="text-caption text-balance font-bold leading-tight">
                    {area.title}
                  </span>
                  {/* Pushed to the bottom of the card. One of the seven titles
                      ("Women Empowerment") needs a couple of pixels more than
                      the column gives it and wraps to two lines; bottom-
                      aligning the subtitles keeps the row even rather than
                      shrinking the type to force a single line. */}
                  <span className="text-overline text-muted-foreground mt-auto text-balance leading-tight tracking-normal">
                    {area.blurb}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </PageShell>
    </section>
  );
}
