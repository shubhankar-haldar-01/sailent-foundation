import type { Metadata } from 'next';
import { LayoutGrid } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { ProgramCard } from '@/components/programs/program-card';
import { ProgramFilters } from '@/components/programs/program-filters';
import { ProgramsHero } from '@/components/programs/programs-hero';
import {
  parseProgramsQuery,
  programAreas,
  programsHref,
  programsView,
  type ProgramsView,
} from '@/components/programs/programs-query';
import { SupportPrograms } from '@/components/programs/support-programs';
import { ViewMorePrograms } from '@/components/programs/view-more-programs';
import { buildMetadata } from '@/lib/seo/metadata';
import { getPrograms } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Programs',
  description:
    'Our long-term programs — run for years, measured over time — and the campaigns that fund specific pieces of them.',
  path: '/programs',
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The programs listing, matched to the owner's design (2026-10-08): hero,
 * breadcrumb band, area pills, a grid of programme cards with "View More
 * Programs", and a closing "Support our programs" panel. The global footer
 * follows.
 *
 * EVERYTHING ON IT IS LIVE DATA. The programmes, their areas, covers and
 * open-campaign counts come from the API (`getPrograms`) in the order the CMS
 * sets; the pills are the areas those programmes have; the grid shows six at a
 * time and "View More Programs" appears only while more remain. Any number of
 * programmes works — none, one, six or a hundred.
 *
 * The area and the page count live in the URL (`programs-query.ts`), so the
 * page is server-rendered for every state and needs no client script.
 */
export default async function ProgramsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = parseProgramsQuery(await searchParams);
  const programs = await getPrograms();
  const areas = programAreas(programs);
  const view = programsView(programs, query);

  return (
    <>
      <ProgramsHero />

      <div className="bg-surface-tint/55 border-border/50 border-y">
        <PageShell className="py-3.5">
          <Breadcrumbs
            className="mb-0"
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Programs', path: '/programs' },
            ]}
          />
        </PageShell>
      </div>

      <section aria-labelledby="programs-list-title" className="pb-12 pt-8 md:pb-14 md:pt-10">
        <PageShell>
          <h2 id="programs-list-title" className="sr-only">
            All programs
          </h2>

          {/* One area or none is nothing to choose between. */}
          {areas.length > 1 ? <ProgramFilters areas={areas} activeArea={view.activeArea} /> : null}

          {/* What is on screen, in words — announced when a pill or "View More" changes it. */}
          <p role="status" className="sr-only">
            {summary(view)}
          </p>

          {view.visible.length === 0 ? (
            <NoPrograms />
          ) : (
            <ul
              aria-label="Programs"
              className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7"
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
              href={programsHref({ category: view.activeArea, page: view.page + 1 })}
            />
          ) : null}
        </PageShell>
      </section>

      <SupportPrograms />
    </>
  );
}

function summary(view: ProgramsView): string {
  const total = view.matching.length;
  const scope = view.activeArea ? ` in ${view.activeArea}` : '';
  if (total === 0) return 'No programs to show.';
  return view.visible.length < total
    ? `Showing ${view.visible.length} of ${total} programs${scope}.`
    : `${total} ${total === 1 ? 'program' : 'programs'}${scope}.`;
}

function NoPrograms() {
  return (
    <div className="border-border bg-surface mt-8 flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="bg-primary/10 text-cta-glow grid size-12 place-items-center rounded-full">
        <LayoutGrid className="size-6" aria-hidden="true" />
      </span>
      <p className="font-display text-h4 mt-4 font-bold">No programs published yet</p>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-md">
        Programs appear here as soon as they are published.
      </p>
    </div>
  );
}
