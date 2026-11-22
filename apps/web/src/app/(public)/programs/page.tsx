import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, LayoutGrid } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { ProgramCard } from '@/components/programs/program-card';
import { ProgramToolbar } from '@/components/programs/program-toolbar';
import {
  parseProgramsQuery,
  programAreaOptions,
  programsHref,
  programsView,
} from '@/components/programs/programs-query';
import { ViewMorePrograms } from '@/components/programs/view-more-programs';
import { InteriorHero } from '@/components/sections/interior-hero';
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
 * The programs listing, matched to the owner's design (2026-10-14), with the
 * split hero since 2026-11-22 (words and breadcrumb beside the photograph):
 * the listing's introduction (a two-tone heading and a line of text), the toolbar (category menu, search and count), a grid of
 * compact programme cards
 * with "View more programs". The global footer follows. (The closing "Support
 * our programs" panel was removed at the owner's request, 2026-10-14.)
 *
 * EVERYTHING ON IT IS LIVE DATA. The programmes, their areas, covers and
 * open-campaign counts come from the API (`getPrograms`) in the order the CMS
 * sets; the toolbar's areas are the areas those programmes have; the grid
 * shows six at a time and "View more programs" appears only while more
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
      {/* Owner, 2026-11-22: the split hero — words beside the photograph, the
          breadcrumb visible, no title baked into the image (AGENTS.md §11 item 25). */}
      <InteriorHero
        variant="split"
        id="programs-title"
        breadcrumbs={[
          { name: 'Home', path: '/' },
          { name: 'Programs', path: '/programs' },
        ]}
        eyebrow="Programs"
        eyebrowIcon={BookOpen}
        title="Long-term work, lasting impact"
        lead="Our programs run for years and are measured over time. Campaigns fund specific pieces of them, which is why a campaign always belongs to a program."
        image={{
          src: '/images/programs-hero.webp',
          alt: 'A teacher with children studying outdoors beside a mobile health clinic, while volunteers water saplings',
          position: '40% 50%',
        }}
      />

      <section
        id="programs-list"
        aria-labelledby="programs-list-title"
        className="scroll-mt-6 pb-16 pt-2 md:pb-20 lg:pb-24"
      >
        <PageShell>
          {/*
            The listing's own introduction (owner's design, 2026-10-14), in the
            owner's words — set as a SECTION heading since the split hero above
            carries the page's h1 (2026-11-22). At its old display size it
            out-shouted the page title.
          */}
          <h2
            id="programs-list-title"
            className="font-display text-h2 text-foreground font-semibold tracking-tight"
          >
            Explore <span className="text-primary">our programs</span>
          </h2>
          <p className="text-muted-foreground mt-2 max-w-[44rem] text-base sm:text-[1.0625rem]">
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
      <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
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
