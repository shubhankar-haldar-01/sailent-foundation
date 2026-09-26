import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { formatDate } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { MediaFrame } from '@/components/media/media-frame';
import { PostCard } from '@/components/blog/post-card';
import { buildMetadata } from '@/lib/seo/metadata';
import { blogPostingSchema, jsonLd } from '@/lib/seo/structured-data';
import { renderMarkdown, plainTextFrom } from '@/lib/blog/markdown';
import { getBlogPost, type BlogPostDetail } from '@/lib/content';

/*
  ══════════════════════════════════════════════════════════════════════════
  NO `generateStaticParams`, AND THAT IS DELIBERATE.

  The previous version listed all eight mock posts and pre-rendered them. This
  route is now dynamic, for two reasons:

  1. DRAFTS MUST NOT LEAK THROUGH THE BUILD. Pre-rendering means asking the API
     for a list of slugs at build time and trusting it. The public list only
     ever contains published posts, so it would be correct today — but a route
     whose safety depends on a build-time snapshot fails silently the moment
     something is unpublished, because the old HTML stays on disk.

  2. UNPUBLISHING MUST TAKE EFFECT. An archived article has to stop being
     readable immediately, not at the next deployment.

  The cost is a request per view rather than a file, which `publicCache` in the
  content layer absorbs with a 300-second revalidate and a `blog` tag that the
  admin actions invalidate on every publish.
  ══════════════════════════════════════════════════════════════════════════
*/

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const result = await getBlogPost((await params).slug);

  if (!result || 'redirectTo' in result) {
    return buildMetadata({ title: 'Article not found', path: '/blog', noIndex: true });
  }

  /*
    THE `noIndex` IS GONE. It was there because the posts were invented; every
    post reaching this page is now a published row somebody wrote.

    The SEO fields fall back rather than being required: an editor who writes
    neither still gets a sensible title and a description drawn from the
    summary, or from the opening of the article itself.
  */
  return buildMetadata({
    title: result.metaTitle ?? result.title,
    description:
      result.metaDescription ?? result.excerpt ?? (plainTextFrom(result.content) || undefined),
    path: `/blog/${result.slug}`,
    type: 'article',
    ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
    modifiedAt: result.updatedAt,
    ...(result.featuredImageUrl
      ? { image: { url: result.featuredImageUrl, alt: result.featuredImageAlt ?? result.title } }
      : {}),
    /*
      An article first published elsewhere points at the original. Left null —
      which is the normal case — `buildMetadata` makes the page its own
      canonical, which is the honest default.
    */
    ...(result.canonicalUrl ? { canonicalOverride: result.canonicalUrl } : {}),
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getBlogPost(slug);

  if (!result) notFound();

  /*
    A renamed article 301s to its current address rather than 404ing. The API
    resolves the retired slug through `slug_history`, which is the same
    mechanism campaigns and programmes already use.
  */
  if ('redirectTo' in result) permanentRedirect(`/blog/${result.redirectTo}`);

  const post: BlogPostDetail = result;
  const schema = blogPostingSchema({
    title: post.title,
    slug: post.slug,
    description: post.metaDescription ?? post.excerpt,
    imageUrl: post.featuredImageUrl,
    authorName: post.authorName,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  });

  return (
    <>
      {schema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(schema)} />
      ) : null}

      <Section className="pt-10 md:pt-14">
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Blog', path: '/blog' },
              { name: post.title, path: `/blog/${post.slug}` },
            ]}
          />

          <article>
            <header className="prose-measure">
              {post.categoryName ? (
                <p className="text-overline tracking-(--text-overline--letter-spacing) text-primary uppercase">
                  {post.categorySlug ? (
                    <Link href={`/blog?category=${post.categorySlug}`} className="hover:underline">
                      {post.categoryName}
                    </Link>
                  ) : (
                    post.categoryName
                  )}
                </p>
              ) : null}

              <h1 className="font-display text-h1 mt-2 font-bold tracking-tight">{post.title}</h1>

              {post.excerpt ? (
                <p className="text-body-lg text-muted-foreground mt-4">{post.excerpt}</p>
              ) : null}

              <p className="text-body-sm text-muted-foreground mt-4">
                {/*
                  A NAME AND A DATE, and nothing else about the author. The API
                  sends no id and no email, so there is nothing more to show
                  even if this page wanted to.
                */}
                {post.authorName ? <span>{post.authorName}</span> : null}
                {post.authorName && post.publishedAt ? <span aria-hidden="true"> · </span> : null}
                {post.publishedAt ? (
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                ) : null}
              </p>
            </header>

            {post.featuredImageUrl ? (
              <MediaFrame
                media={{
                  seed: `blog-${post.slug}`,
                  alt: post.featuredImageAlt ?? post.title,
                  url: post.featuredImageUrl,
                }}
                aspect="video"
                className="mt-8"
              />
            ) : null}

            {/*
              The article body. `renderMarkdown` returns React ELEMENTS and
              never HTML, so nothing an author typed can become markup — see
              `lib/blog/markdown.tsx` for why that is the whole safety argument.
            */}
            <div className="prose-measure mt-10">{renderMarkdown(post.content)}</div>

            {post.tags.length > 0 ? (
              <footer className="border-border prose-measure mt-12 border-t pt-6">
                <h2 className="text-body-sm font-medium">Tagged</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li key={tag.slug}>
                      <Link
                        href={`/blog?tag=${tag.slug}`}
                        className="border-border-strong text-caption hover:border-primary rounded-md border px-3 py-1.5"
                      >
                        {tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </footer>
            ) : null}
          </article>
        </PageShell>
      </Section>

      {post.related.length > 0 ? (
        <Section className="bg-surface-sunken">
          <PageShell>
            <h2 className="text-h3 mb-6 font-semibold">More from the blog</h2>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {post.related.map((related) => (
                <PostCard key={related.slug} post={related} />
              ))}
            </div>
          </PageShell>
        </Section>
      ) : null}
    </>
  );
}
