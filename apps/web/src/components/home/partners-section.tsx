'use client';

import * as React from 'react';
import { Pause, Play } from 'lucide-react';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { partners, type Partner } from '@/lib/mock/home';

/**
 * A single partner's mark.
 *
 * Falls back to a wordmark when no logo has been supplied, so the strip is
 * never a row of broken images. The greyscale-until-hover treatment is what
 * keeps eight marks from competing with the donate button above them.
 */
export function PartnerLogo({ partner }: { partner: Partner }) {
  if (partner.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={partner.logoUrl}
        alt={partner.name}
        className="h-8 w-auto opacity-85 transition hover:opacity-100 lg:h-9"
      />
    );
  }

  return (
    <span className="text-caption text-muted-foreground hover:text-foreground whitespace-nowrap font-bold tracking-tight transition-colors">
      {partner.name}
    </span>
  );
}

/**
 * How long one full pass takes, derived from the number of marks.
 *
 * A FIXED duration would make the strip faster every time a partner is added,
 * because the same seconds would have to cover more width. Seconds-per-logo
 * keeps the apparent speed constant however long the list grows — which is the
 * thing a reader actually perceives.
 */
const SECONDS_PER_LOGO = 5;

/**
 * Partners and supporters.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `partners` IS CURRENTLY EMPTY, so this band does not render at all — see
 * lib/mock/home.ts for what was in it and why it went.
 *
 * The section renders nothing when the list is empty, so emptying it is how
 * this band is removed rather than deleting the component. Everything below
 * still works and is still tested; it is waiting for a confirmed partner.
 *
 * The strip SCROLLS ITSELF, as a CSS animation rather than a timer. The list
 * is rendered twice: once as the real list, and once `aria-hidden` to give the
 * loop something to hand over to. A screen reader hears eight partners, not
 * sixteen.
 *
 * THE PAUSE CONTROL IS THERE, AND IT IS INVISIBLE UNTIL TABBED TO.
 *
 * WCAG 2.2.2 (Level A) requires a mechanism to stop anything that starts on its
 * own, runs longer than five seconds and sits beside other content. All three
 * are true here, so deleting the control outright would fail at Level A. What
 * the requirement asks for is that a mechanism EXIST and be operable — not that
 * it occupy a button in the design.
 *
 * So there are three, layered, and none of them is a piece of visible chrome:
 *
 *   • Hover pauses it, in CSS alone, so it works with no script at all.
 *   • Focus-within pauses it, for anyone moving through the page by keyboard.
 *   • A real button, positioned out of sight and revealed the moment it takes
 *     focus — the same technique as the skip link at the top of every page.
 *
 * It is absolutely positioned rather than `sr-only`, so revealing it does not
 * reflow the row and shunt the logos sideways under a keyboard user.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function PartnersSection() {
  const [isPaused, setIsPaused] = React.useState(false);

  if (partners.length === 0) return null;

  const marks = (
    <>
      {partners.map((partner) => (
        <li key={partner.id} className="shrink-0">
          <PartnerLogo partner={partner} />
        </li>
      ))}
    </>
  );

  return (
    <section aria-labelledby="partners-title" className="bg-surface border-border border-b">
      <PageShell className="py-5 lg:py-6">
        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
          <h2 id="partners-title" className="text-body-lg whitespace-nowrap font-bold">
            Our Partners &amp; Supporters
          </h2>

          {/*
            `w-full` first, `min-w-0 flex-1` only from `sm`.

            The row is a wrapping flex container, so once the heading drops to
            its own line a `flex-1` strip takes its basis from what was left of
            the FIRST line — 200px of a 358px phone. `min-w-0` is what lets the
            strip shrink below the intrinsic width of eight logos in a row;
            without it the flex item refuses to go under its content width and
            the marquee pushes the page sideways.
          */}
          <div
            data-paused={isPaused ? 'true' : undefined}
            style={
              {
                '--marquee-gap': '1.5rem',
                '--marquee-duration': `${partners.length * SECONDS_PER_LOGO}s`,
              } as React.CSSProperties
            }
            className="marquee w-full sm:min-w-0 sm:flex-1"
          >
            <ul aria-label="Our partners and supporters" className="list-none">
              {marks}
            </ul>
            {/*
              The seam copy. `aria-hidden` and untabbable: it exists so the
              animation has somewhere to hand over to, and it is the same eight
              names again.
            */}
            <ul aria-hidden="true" className="list-none">
              {marks}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-pressed={isPaused}
            className={cn(
              /*
                Out of the layout and out of sight, but still in the
                accessibility tree and still reachable by Tab.

                `opacity-0` rather than `sr-only` or `hidden`: both of those
                would either reflow the row when it appears or drop the button
                from the tree entirely. A transparent element is announced and
                focusable exactly like a visible one.

                `pointer-events-none` so a pointer cannot land on a control
                nobody can see — the mouse path to pausing is simply hovering
                the strip.
              */
              'pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 opacity-0',
              // The moment it takes focus it is an ordinary, visible button.
              'focus:pointer-events-auto focus:opacity-100',
              'border-border bg-surface grid size-8 place-items-center rounded-full border shadow-sm transition-opacity',
              'hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              // Removed outright for anyone who asked for reduced motion: the
              // strip is a static wrapping row for them, so a control to stop
              // it would be a control for something that is not happening.
              'motion-reduce:hidden',
            )}
          >
            {isPaused ? (
              <Play className="size-3.5" aria-hidden="true" />
            ) : (
              <Pause className="size-3.5" aria-hidden="true" />
            )}
            {/* Says what the button DOES, not what the state is. */}
            <span className="sr-only">
              {isPaused
                ? 'Resume the scrolling list of partners'
                : 'Pause the scrolling list of partners'}
            </span>
          </button>
        </div>
      </PageShell>
    </section>
  );
}
