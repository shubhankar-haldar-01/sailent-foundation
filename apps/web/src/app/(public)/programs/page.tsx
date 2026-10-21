import type { Metadata } from 'next';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';

import { cn } from '@sailent/ui';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { ProgramCard } from '@/components/programs/program-card';
import { ProgramToolbar } from '@/components/programs/program-toolbar';
import { ProgramsHero } from '@/components/programs/programs-hero';
import {
  parseProgramsQuery,
  programAreaOptions,
  programsHref,
  programsView,
} from '@/components/programs/programs-query';
import { ViewMorePrograms } from '@/components/programs/view-more-programs';
import { buildMetadata } from '@/lib/seo/metadata';
import { getPrograms } from '@/lib/content';
import { headingExtraBold } from '@/lib/fonts';

export const metadata: Metadata = buildMetadata({
  title: 'Programs',
  description:
    'Our long-term programs — run for years, measured over time — and the campaigns that fund specific pieces of them.',
  path: '/programs',
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The programs listing, matched to the owner's design (2026-10-14): hero,
 * breadcrumb band, the listing's introduction (eyebrow, two-tone heading and
 * a line of text), the toolbar (category menu, search and count), a grid of
 * compact programme cards
 * with "View More Programs". The global footer follows. (The closing "Support
 * our programs" panel was removed at the owner's request, 2026-10-14.)
 *
 * EVERYTHING ON IT IS LIVE DATA. The programmes, their areas, covers and
 * open-campaign counts come from the API (`getPrograms`) in the order the CMS
 * sets; the toolbar's areas are the areas those programmes have; the grid
 * shows six at a time and "View More Programs" appears only while more
 * remain. Any number of programmes works — none, one, six or a hundred.
 *
 * The area, the search and the page count live in the URL
 * (`programs-query.ts`), so the page is server-rendered for every state. The
 * only client script is the toolbar's menu and search box; "View More" is a
 * plain link that works without it.
 */
export default async function ProgramsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseProgramsQuery(await searchParams);
  const programs = await getPrograms();
  const areas = programAreaOptions(programs);
  const view = programsView(programs, query);
  const filtered = Boolean(view.activeArea || query.q);

  return (
    <>
      <ProgramsHero />

      <div className="sr-only">
        <Breadcrumbs
          entries={[
            { name: 'Home', path: '/' },
            { name: 'Programs', path: '/programs' },
          ]}
        />
      </div>

      <section
        id="programs-list"
        aria-labelledby="programs-list-title"
        className="scroll-mt-6 pb-16 pt-10 md:pb-20 lg:pb-24 lg:pt-12"
      >
        <PageShell>
          {/* The listing's own introduction, as the owner's design draws it (2026-10-14). */}
          <p className="text-primary flex items-center gap-4 text-sm font-semibold uppercase leading-6 tracking-[0.24em]">
            <span aria-hidden="true" className="bg-cta-bright h-0.5 w-11 shrink-0 rounded-full" />
            Our programs
          </p>
          <h2
            id="programs-list-title"
            className={cn(
              headingExtraBold.className,
              'text-foreground mt-1.5 text-[clamp(2rem,0.6rem+3.3vw,3.625rem)] leading-[1.12] tracking-[-0.025em]',
            )}
          >
            {/* Display size only: the bright orange is for large text (`--cta-bright`). */}
            Explore <span className="text-cta-bright">our programs</span>
          </h2>
          <p className="text-foreground/80 mt-3 max-w-[44rem] text-[1.0625rem] leading-[1.4] sm:text-lg xl:text-xl">
            Focused initiatives that create real and lasting change in communities.
          </p>

          {/* Nothing to search or narrow until there is a programme. */}
          {programs.length > 0 ? <ProgramToolbar areas={areas} query={query} view={view} /> : null}

          {view.visible.length === 0 ? (
            <NoPrograms filtered={filtered} />
          ) : (
            <ul
              aria-label="Programs"
              className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3"
            >
              {view.visible.map((program, index) => (
                <li key={program.slug} className="flex">
                  <ProgramCard program={program} imagePriority={index === 0} className="w-full" />
                </li>
              ))}
            </ul>
          )}

          {view.hasMore ? (
            <ViewMorePrograms
              href={programsHref({ category: view.activeArea, q: query.q, page: view.page + 1 })}
            />
          ) : null}
        </PageShell>
      </section>
    </>
  );
}

/**
 * Nothing to show: either nothing is published yet, or the search and area
 * in force match nothing — which says so, and offers the way back.
 */
function NoPrograms({ filtered }: { filtered: boolean }) {
  return (
    <div className="border-border bg-surface mt-7 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-primary/10 text-cta-glow grid size-12 place-items-center rounded-full">
        <LayoutGrid className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-h4 mt-4 font-bold">
        {filtered ? 'No programs match' : 'No programs published yet'}
      </p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        {filtered
          ? 'Try another word, or clear the filters to see every program.'
          : 'Programs appear here as soon as they are published.'}
      </p>
      {filtered ? (
        <Link
          href="/programs"
          scroll={false}
          className="text-info-action focus-visible:outline-ring mt-4 rounded-sm text-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          View all programs
        </Link>
      ) : null}
    </div>
  );
}
