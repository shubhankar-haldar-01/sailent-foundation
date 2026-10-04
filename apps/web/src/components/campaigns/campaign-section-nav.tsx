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
 * THE UNDERLINE FOLLOWS THE READER. An IntersectionObserver marks whichever
 * section is in the upper part of the screen, so the row tells somebody where
 * they are as well as where they can go. It is set with `aria-current`, which
 * is what a screen reader reads out; the colour is the second signal.
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
  const key = sections.map((section) => section.id).join('|');

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
        const current = ids.find((id) => showing.get(id));
        if (current) setActive(current);
      },
      // The band between the sticky header and a little under halfway down:
      // a section counts as "here" once it has reached where people read.
      { rootMargin: '-96px 0px -55% 0px' },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [key]);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="Campaign sections" className={cn('border-border border-b', className)}>
      {/* Scrolls sideways inside itself on a narrow phone rather than pushing
          the page wider than the screen. */}
      <ul className="rail -mb-px flex gap-2 overflow-x-auto sm:gap-4">
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
    </nav>
  );
}
