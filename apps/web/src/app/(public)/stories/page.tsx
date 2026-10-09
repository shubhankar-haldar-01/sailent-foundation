import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { FeaturedStory } from '@/components/stories/featured-story';
import { StoriesCta } from '@/components/stories/stories-cta';
import { LeafFan } from '@/components/stories/stories-decor';
import { StoriesHero } from '@/components/stories/stories-hero';
import { StoryCard } from '@/components/stories/story-card';
import { StoryFilters } from '@/components/stories/story-filters';
import { buildMetadata } from '@/lib/seo/metadata';
import { getPrograms, getStoriesPage, getStoryCategories } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Stories',
  description:
    'Real stories from real people — children, families and communities whose lives are changing through our long-term work.',
  path: '/stories',
});

/** One lead story and two rows of three. */
const FIRST_BATCH = 7;
/** "View More Stories" adds two more rows. */
const BATCH = 6;
const MAX_SHOWN = 100;

/*
  ══════════════════════════════════════════════════════════════════════════
  The Stories page, as the owner's page design lays it out (2026-10-08).

  EVERYTHING ON IT IS READ, NOTHING IS FIXED. The categories offered are the
  ones published stories are filed under (a story's own category, else its
  programme's — owner decision); the lead is the newest story in the current
  view; "View More Stories" asks for six more of the same view, as a plain
  link (`?count=`), so it works without JavaScript and keeps the filter.
  ══════════════════════════════════════════════════════════════════════════
*/
export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; count?: string }>;
}) {
  const params = await searchParams;
  const requestedCount = Number(params.count ?? FIRST_BATCH);
  const count = Number.isInteger(requestedCount)
    ? Math.min(MAX_SHOWN, Math.max(FIRST_BATCH, requestedCount))
    : FIRST_BATCH;

  const programs = await getPrograms();
  const categories = await getStoryCategories(
    programs.map((program) => program.category).filter((c): c is string => Boolean(c)),
  );
  const asked = params.category?.trim().slice(0, 80) || null;
  // The canonical spelling when the category is one we offer; as asked otherwise.
  const category =
    (asked && categories.find((name) => name.toLowerCase() === asked.toLowerCase())) || asked;

  const result = await getStoriesPage(1, { category: category ?? undefined, limit: count });
  const [lead, ...rest] = result.stories;
  const hasMore = result.total > result.stories.length;

  const moreHref = `/stories?${new URLSearchParams({
    ...(category ? { category } : {}),
    count: String(count + BATCH),
  }).toString()}`;

  return (
    <>
      <StoriesHero />

      <PageShell className="pb-12 pt-1.5">
        {/* A little inside the page width, as the design sets the listing. */}
        <div className="lg:px-2.5">
          <Breadcrumbs
            className="mb-0 text-[0.75rem]"
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Stories', path: '/stories' },
            ]}
          />

          {categories.length > 0 ? (
            <StoryFilters categories={categories} current={category} />
          ) : null}

          {lead ? (
            <>
              <FeaturedStory story={lead} />

              {rest.length > 0 ? (
                <section aria-labelledby="more-stories" className="mt-5">
                  <h2 id="more-stories" className="sr-only">
                    More stories
                  </h2>
                  <div className="grid gap-[1.125rem] sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((story) => (
                      <StoryCard key={story.slug} story={story} />
                    ))}
                  </div>
                </section>
              ) : null}

              {hasMore ? (
                <div className="mt-4 flex justify-center">
                  <span className="relative">
                    <Link
                      href={moreHref}
                      scroll={false}
                      className="bg-wash-coral/80 text-primary hover:bg-primary-light focus-visible:outline-ring inline-flex h-12 items-center gap-2 rounded-full px-12 text-[0.9375rem] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-[5.5rem]"
                    >
                      View More Stories
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                    <LeafFan className="text-cta-glow absolute -right-[2.125rem] -top-1.5 h-12 w-auto" />
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="border-border text-muted-foreground mt-8 rounded-2xl border border-dashed p-10 text-center">
              {category ? (
                <>
                  No stories in {category} yet.{' '}
                  <Link href="/stories" className="text-primary font-semibold underline">
                    See all stories
                  </Link>
                </>
              ) : (
                'No stories have been published yet.'
              )}
            </p>
          )}
        </div>
      </PageShell>

      <StoriesCta />
    </>
  );
}
