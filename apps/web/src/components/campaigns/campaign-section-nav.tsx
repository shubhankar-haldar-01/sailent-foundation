'use client';

import * as React from 'react';

import { cn } from '@sailent/ui';

export interface CampaignSectionLink {
  /** The `id` of the section on this page. */
  id: string;
  label: string;
}

/**
 * The campaign's section links — Products, About, Stories, Impact, FAQs.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LINKS, NOT TABS, BECAUSE NOTHING IS HIDDEN.
 *
 * This row used to be a tab list that swapped one block of content for
 * another. Every section is now on the page in reading order, so a tab
 * pattern would announce panels that do not exist and trap arrow keys for
 * no reason. These are ordinary in-page links in a labelled `nav`: Tab moves
 * between them, Enter jumps, and the browser's own history works.
 *
 * IT STAYS IN REACH. The row sticks under the site header while the main
 * column scrolls, so the reader can jump from the FAQs back to the products
 * without scrolling the whole page; sections carry `scroll-mt-32` so a jump
 * lands below the header and this row, not under them.
 *
 * THE UNDERLINE FOLLOWS THE READER. An IntersectionObserver marks whichever
 * section is in the upper part of the screen, so the row tells somebody where
 * they are as well as where they can go. It is set with `aria-current`, which
 * is what a screen reader reads out; the colour is the second signal.
 *
 * IT SAYS WHEN THERE IS MORE. On a narrow phone the row scrolls sideways, and
 * a last link cut off at the edge looked like the whole list. A fade appears
 * on whichever side has more links, and the current link is scrolled into the
 * row as the reader moves down the page.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignSectionNav({
  sections,
  className,
}: {
  sections: CampaignSectionLink[];
  className?: string;
}) {
  const [active, setActive] = React.useState(sections[0]?.id);
  const [more, setMore] = React.useState({ before: false, after: false });
  const listRef = React.useRef<HTMLUListElement>(null);
  const key = sections.map((section) => section.id).join('|');

  const measure = React.useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const before = list.scrollLeft > 1;
    const after = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setMore((current) =>
      current.before === before && current.after === after ? current : { before, after },
    );
  }, []);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure, key]);

  // Keep the current link inside the row. Only the row scrolls — never the
  // page, which `scrollIntoView` would also move.
  React.useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!list || !link) return;
    const start = link.offsetLeft - list.offsetLeft;
    const end = start + link.offsetWidth;
    if (start < list.scrollLeft || end > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, start - 24), behavior: 'smooth' });
    }
  }, [active]);

  React.useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const ids = key.split('|');
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length === 0) return;

    const showing = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) showing.set(entry.target.id, entry.isIntersecting);
        // The LOWEST section in the reading band: when two are in it, the upper
        // one is just ending and the lower one is what is being read.
        const current = [...ids].reverse().find((id) => showing.get(id));
        if (current) setActive(current);
      },
      // The band between the sticky header and a little under halfway down:
      // a section counts as "here" once it has reached where people read.
      { rootMargin: '-136px 0px -55% 0px' },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [key]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Campaign sections"
      className={cn(
        // STICKY under the header (64px, 72px from `md`) for the length of the
        // main column, so any section is one press away however far down the
        // page somebody has read. A solid page-coloured backing keeps the text
        // beneath from showing through.
        'border-border bg-background md:top-18 sticky top-16 z-30 border-b',
        className,
      )}
    >
      {/* Scrolls sideways inside itself on a narrow phone rather than pushing
          the page wider than the screen. */}
      <ul
        ref={listRef}
        onScroll={measure}
        className="rail -mb-px flex gap-2 overflow-x-auto sm:gap-4"
      >
        {sections.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                onClick={() => setActive(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'text-body-sm focus-visible:outline-ring relative flex min-h-10 items-center rounded-t-md px-3 font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
                  // The underline is a pseudo-element, so it tracks the current
                  // link without a second element to keep in sync.
                  'after:bg-success after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:opacity-0',
                  isActive
                    ? // `-ink-strong` on the mint wash: the ordinary ink measures 4.31:1.
                      'bg-wash-mint/70 text-wash-mint-ink-strong after:opacity-100'
                    : 'text-foreground/80 hover:text-foreground',
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>

      {/* The fades: decoration only — every link is reachable by Tab anyway. */}
      <span
        aria-hidden="true"
        className={cn(
          'from-background pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent transition-opacity',
          more.before ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'from-background pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent transition-opacity',
          more.after ? 'opacity-100' : 'opacity-0',
        )}
      />
    </nav>
  );
}
