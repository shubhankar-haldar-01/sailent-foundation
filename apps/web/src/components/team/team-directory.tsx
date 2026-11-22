'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowDown, ChevronDown, Search } from 'lucide-react';

import { Button } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { InteriorHero } from '@/components/sections/interior-hero';
import type { TeamMember } from '@/lib/mock/types';
import { MemberCard } from './member-card';

interface TeamDirectoryProps {
  initialMembers: TeamMember[];
}

/** People per page: two rows of six on a wide screen, three of four on a tablet. */
const PAGE = 12;

/** Where "Meet our team" lands. */
const GRID_ID = 'team-members';

/**
 * The /team page below the site header: an editorial hero, then the people.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE HERO (owner brief, 2026-11-22): typography-led and open — the `editorial`
 * variant of the shared `InteriorHero` (`AGENTS.md` §11 item 25), in the
 * brand's green and Inter. "Our people", the heading, one line, "Meet our team"
 * (a plain in-page link: the site's smooth scroll, off under reduced motion,
 * and it works without JavaScript), and the live head count beside it.
 *
 * NO PORTRAITS IN THE HERO until genuine photographs of the team exist: the
 * brief allows only real team photographs, and the current portraits are not
 * known to be. The cards below show whatever Admin → Team holds.
 *
 * NO DEPARTMENT FILTERS (owner, 2026-11-22): everyone has the same role and a
 * card shows only a portrait and a name. The SEARCH stays and matches names
 * only — the one thing a card shows. "Show more people" appears only beyond
 * two rows. Leadership is not listed here (it is on About).
 * ══════════════════════════════════════════════════════════════════════════
 */
export function TeamDirectory({ initialMembers }: TeamDirectoryProps) {
  const searchId = useId();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE);

  const staff = useMemo(
    () => initialMembers.filter((m) => m.department !== 'Leadership'),
    [initialMembers],
  );

  const query = searchQuery.toLowerCase().trim();
  const matches = useMemo(
    () => (query ? staff.filter((m) => m.name.toLowerCase().includes(query)) : staff),
    [staff, query],
  );

  const shown = matches.slice(0, visibleCount);
  const remaining = matches.length - shown.length;

  if (staff.length === 0) return null;

  return (
    <>
      <InteriorHero
        variant="editorial"
        id="team-title"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Team', path: '/team' },
        ]}
        eyebrow="Our people"
        title="The people behind every possibility."
        lead="Meet the people who share a vision of creating meaningful change through community, compassion and action."
        actions={
          <Button asChild size="lg">
            <a href={`#${GRID_ID}`}>
              Meet our team
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </Button>
        }
        aside={
          // The head count, from the records: set large, said once.
          <p className="flex items-end gap-4 lg:flex-col lg:items-start lg:gap-2">
            <span
              aria-hidden="true"
              className="font-display text-primary text-[clamp(3rem,2.2rem+2.6vw,4.5rem)] font-light tabular-nums leading-none tracking-[-0.04em]"
            >
              {String(staff.length).padStart(2, '0')}
            </span>
            <span className="text-muted-foreground pb-1 text-sm leading-snug lg:pb-0">
              <span className="sr-only">{staff.length} </span>
              {staff.length === 1 ? 'team member' : 'team members'}
            </span>
          </p>
        }
      />

      <PageShell>
        <section id={GRID_ID} aria-labelledby="our-team-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2
              id="our-team-heading"
              className="font-display text-h2 text-foreground font-semibold tracking-tight"
            >
              Our team
            </h2>
            <div className="relative w-full sm:w-72">
              <label htmlFor={searchId} className="sr-only">
                Search team members
              </label>
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2"
              />
              <input
                id={searchId}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(PAGE);
                }}
                placeholder="Search by name..."
                className="border-border bg-surface text-foreground placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:ring-primary/20 h-11 w-full rounded-lg border pl-10 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2"
              />
            </div>
          </div>

          {/* Announced to screen readers as the search narrows the list. */}
          <p aria-live="polite" className="sr-only">
            {query
              ? `${matches.length} ${matches.length === 1 ? 'person matches' : 'people match'}`
              : ''}
          </p>

          {shown.length > 0 ? (
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-6 lg:gap-y-10 xl:grid-cols-6">
              {shown.map((member) => (
                <li key={member.slug}>
                  <MemberCard member={member} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border mt-8 border-y px-6 py-12 text-center">
              <p className="text-foreground text-base font-semibold">
                No one on the team is called &ldquo;{searchQuery.trim()}&rdquo;
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Check the spelling, or try a first name.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            </div>
          )}

          {remaining > 0 ? (
            <div className="mt-12 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setVisibleCount((prev) => prev + PAGE)}
              >
                Show more people
                <span className="text-muted-foreground font-normal tabular-nums">
                  ({remaining})
                </span>
                <ChevronDown aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
        </section>
      </PageShell>
    </>
  );
}
