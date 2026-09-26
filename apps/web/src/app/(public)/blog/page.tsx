import Link from 'next/link';
import type { Metadata } from 'next';

import { Button } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { PostCard } from '@/components/blog/post-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { getBlogCategories, getBlogPage } from '@/lib/content';

/*
  ══════════════════════════════════════════════════════════════════════════
  THE `noIndex` THAT USED TO BE HERE IS GONE, AND THAT IS THE POINT.

  This page rendered eight FABRICATED posts from `@/lib/mock/blog.ts` —
  invented titles, invented authors, invented dates — so it carried
  `noIndex: true`, and `app/sitemap.ts` carried a matching exclusion. Both
  comments said the two halves come off together when a real blog lands.

  It has landed. Every post here is a row in `blog_posts` that a Super Admin
  wrote and deliberately published, so decision A14 is satisfied: the claim the
  page makes traces to a real record.

  DRAFTS CANNOT REACH THIS PAGE. The API's public read pins
  `status = 'published'` in SQL and takes no argument that can widen it.
  ══════════════════════════════════════════════════════════════════════════
*/
export const metadata: Metadata = buildMetadata({
  title: 'Blog',
  description:
    'Field notes on measurement, cost and what we get wrong — written by the people running the programs.',
  path: '/blog',
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string; q?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;

  const [result, categories] = await Promise.all([
    getBlogPage(page, { category: params.category, q: params.q, tag: params.tag }),
    getBlogCategories(),
  ]);

  /*
    The newest post leads the page, but only on the FIRST page and only when
    nothing is being filtered. A "featured" card at the top of page three, or
    above a set of search results, is just a bigger card.
  */
  const unfiltered = page === 1 && !params.category && !params.q && !params.tag;
  const [lead, ...rest] = unfiltered ? result.posts : [];
  const grid = unfiltered ? rest : result.posts;

  return (
    <>
      <PageHero
        eyebrow="Writing"
        title="Field notes"
        lead="How we think about measurement, procurement and cost — including the programs we discontinued and why."
      />
      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Blog', path: '/blog' },
            ]}
          />

          <div className="mb-10 flex flex-wrap items-center gap-3">
            {categories.length > 0 ? (
              <nav aria-label="Article categories">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link
                      href="/blog"
                      aria-current={params.category ? undefined : 'page'}
                      className={chipClass(!params.category)}
                    >
                      All
                    </Link>
                  </li>
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={`/blog?category=${category.slug}`}
                        aria-current={params.category === category.slug ? 'page' : undefined}
                        className={chipClass(params.category === category.slug)}
                      >
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <form className="ml-auto flex gap-2" action="/blog">
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search articles"
                aria-label="Search articles"
                className="border-input bg-surface text-body-sm h-9 rounded-md border px-3"
              />
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>
          </div>

          {result.posts.length === 0 ? (
            /*
              An honest empty state rather than invented articles. This is what
              a reader sees before the first post is published, and what they
              see when a search matches nothing.
            */
            <p className="border-border text-body text-muted-foreground rounded-lg border border-dashed p-12 text-center">
              {params.q
                ? `No article matches “${params.q}”.`
                : params.category || params.tag
                  ? 'No article here yet.'
                  : 'No articles have been published yet. Please check back soon.'}
            </p>
          ) : null}

          {lead ? <PostCard post={lead} featured className="mb-12" /> : null}

          {grid.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {grid.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          ) : null}

          {result.totalPages > 1 ? (
            <nav aria-label="Pages" className="mt-12 flex items-center justify-between">
              <p className="text-body-sm text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </p>
              <div className="flex gap-2">
                {result.page > 1 ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={pageHref(params, result.page - 1)}>Previous</Link>
                  </Button>
                ) : null}
                {result.page < result.totalPages ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={pageHref(params, result.page + 1)}>Next</Link>
                  </Button>
                ) : null}
              </div>
            </nav>
          ) : null}
        </PageShell>
      </Section>
    </>
  );
}

function chipClass(active: boolean) {
  return active
    ? 'bg-primary text-primary-foreground text-caption rounded-md px-3 py-1.5 font-medium'
    : 'border-border-strong text-caption rounded-md border px-3 py-1.5 font-medium hover:border-primary';
}

function pageHref(params: { category?: string; q?: string; tag?: string }, page: number): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  if (params.tag) search.set('tag', params.tag);
  search.set('page', String(page));
  return `/blog?${search.toString()}`;
}
