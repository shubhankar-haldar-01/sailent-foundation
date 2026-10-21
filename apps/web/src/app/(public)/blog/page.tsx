import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

import { Button, cn } from '@sailent/ui';

import { BlogHero } from '@/components/blog/blog-hero';
import { PostCard } from '@/components/blog/post-card';
import { BlogSidebar } from '@/components/blog/blog-sidebar';
import { buildMetadata } from '@/lib/seo/metadata';
import { getBlogCategories, getBlogPage, type BlogPostSummary } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Blog',
  description:
    'Ideas, insights and stories that matter — articles, updates and perspectives on education, healthcare and community development.',
  path: '/blog',
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; category?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;
  const query = params.q?.trim();

  // Load the current page of published articles and latest articles for the sidebar
  const filtered = Boolean(query || params.category || params.tag);
  const [result, latestResult, categories] = await Promise.all([
    getBlogPage(page, { q: query, category: params.category, tag: params.tag }),
    filtered ? getBlogPage(1) : Promise.resolve(null),
    getBlogCategories(),
  ]);

  const latestPosts: BlogPostSummary[] = (latestResult ? latestResult.posts : result.posts).slice(
    0,
    4,
  );

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      {/* 1. Wide editorial hero matching reference design */}
      <BlogHero />

      {/* 2. Main content area: 2-column layout (70-75% articles / 25-30% sidebar) */}
      <section className="py-8 sm:py-10 lg:py-12">
        <div className="container-page mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Main Article Column: ~70-75% width */}
            <div className="flex flex-col lg:col-span-8">
              {/*
                The category chips (docs/phase-10.7.md: "featured lead post,
                category chips, search, pagination"). Server links, so they
                work without scripting; the current one is marked.
              */}
              {categories.length > 0 ? (
                <nav aria-label="Article categories" className="mb-6">
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

              {/* Search active notice */}
              {query ? (
                <div className="shadow-2xs mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700 sm:p-4 sm:text-sm">
                  <p>
                    Showing results for{' '}
                    <span className="font-semibold text-[#102A43]">“{query}”</span> ({result.total}{' '}
                    {result.total === 1 ? 'article' : 'articles'})
                  </p>
                  <Link
                    href="/blog"
                    className="text-primary inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
                  >
                    Clear search
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}

              {/* Empty state */}
              {result.posts.length === 0 ? (
                <div className="shadow-xs rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <p className="text-sm text-slate-600 sm:text-base">
                    {query
                      ? `No articles match “${query}”.`
                      : params.category || params.tag
                        ? 'No article here yet.'
                        : 'No articles have been published yet. Please check back soon.'}
                  </p>
                  {filtered ? (
                    <Button asChild variant="secondary" size="sm" className="mt-4">
                      <Link href="/blog">View all articles</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {/* Horizontal Article Rows */}
              {result.posts.length > 0 ? (
                <div className="space-y-5 sm:space-y-6">
                  {result.posts.map((post, index) => (
                    <PostCard
                      key={post.slug}
                      post={post}
                      featured={index === 0 && page === 1 && !filtered}
                      layout="horizontal"
                    />
                  ))}
                </div>
              ) : null}

              {/* Pagination */}
              {result.totalPages > 1 ? (
                <nav
                  aria-label="Article pages"
                  className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-6 sm:mt-12 sm:flex-row"
                >
                  <p className="text-xs font-medium text-slate-500 sm:text-sm">
                    Page <span className="font-semibold text-slate-700">{result.page}</span> of{' '}
                    <span className="font-semibold text-slate-700">{result.totalPages}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {result.page > 1 ? (
                      <Button asChild variant="secondary" size="sm" className="gap-1.5">
                        <Link
                          href={pageHref(
                            { q: query, category: params.category, tag: params.tag },
                            result.page - 1,
                          )}
                        >
                          <ArrowLeft className="size-3.5" aria-hidden="true" />
                          Previous
                        </Link>
                      </Button>
                    ) : null}
                    {result.page < result.totalPages ? (
                      <Button asChild variant="secondary" size="sm" className="gap-1.5">
                        <Link
                          href={pageHref(
                            { q: query, category: params.category, tag: params.tag },
                            result.page + 1,
                          )}
                        >
                          Next
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </nav>
              ) : null}
            </div>

            {/* Right Sidebar: ~25-30% width */}
            <div className="lg:sticky lg:top-24 lg:col-span-4">
              <BlogSidebar latestPosts={latestPosts} currentQuery={query} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function chipClass(active: boolean) {
  return cn(
    'focus-visible:outline-ring inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-sm',
    active
      ? 'bg-primary text-primary-foreground'
      : 'border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary',
  );
}

function pageHref(params: { q?: string; category?: string; tag?: string }, page: number): string {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.q) search.set('q', params.q);
  if (params.tag) search.set('tag', params.tag);
  search.set('page', String(page));
  return `/blog?${search.toString()}`;
}
