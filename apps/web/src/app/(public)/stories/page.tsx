import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { StoryCard } from '@/components/stories/story-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getFeaturedStory, getStoriesPage } from '@/lib/content';
import Link from 'next/link';

export const metadata: Metadata = buildMetadata({
  title: 'Stories',
  description:
    'What happened, in the words of the people it happened to — including the programs that did not work as intended.',
  path: '/stories',
});

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const requested = Number((await searchParams).page ?? '1');
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [featured, result] = await Promise.all([getFeaturedStory(), getStoriesPage(page)]);

  /*
    The featured story leads the FIRST page only. On page two it would be a
    story the reader has already scrolled past, presented again as though it
    were new.
  */
  const lead = page === 1 ? featured : undefined;
  const rest = result.stories.filter((story) => story.slug !== lead?.slug);

  return (
    <>
      <PageHero
        eyebrow="Stories"
        title="One person, one program, one thing that changed"
        lead="Some of these describe things that worked. Some describe design failures we did not notice for months. Both are here on purpose."
      />
      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Stories', path: '/stories' },
            ]}
          />
          {featured ? <StoryCard story={featured} featured className="mb-12" /> : null}
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((story) => (
              <StoryCard key={story.slug} story={story} />
            ))}
          </div>

          {result.totalPages > 1 ? (
            <nav
              aria-label="Stories pages"
              className="border-border mt-10 flex items-center justify-between border-t pt-6"
            >
              <p className="text-body-sm text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </p>
              <div className="flex gap-3">
                {result.page > 1 ? (
                  <Link
                    href={result.page === 2 ? '/stories' : `/stories?page=${result.page - 1}`}
                    className="text-body-sm hover:text-primary underline"
                  >
                    Newer stories
                  </Link>
                ) : null}
                {result.page < result.totalPages ? (
                  <Link
                    href={`/stories?page=${result.page + 1}`}
                    className="text-body-sm hover:text-primary underline"
                  >
                    Older stories
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </PageShell>
      </Section>
    </>
  );
}
