import 'server-only';

import { isNotFound } from './programs';
import { loadContent, publicCache, type Paginated } from './source';

/**
 * The blog, from the API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO FIXTURE FALLBACK, DELIBERATELY — and this is the one content adapter in
 * the directory without one.
 *
 * Every other loader passes `fallback`, so a developer with no API running
 * still sees a page. That is right for campaigns and programmes, whose
 * fixtures mirror records that genuinely exist.
 *
 * It is wrong here, because fabricated articles are precisely what Phase 10.7
 * removes. `apps/web/src/lib/mock/blog.ts` held eight invented posts with
 * invented authors and invented dates, and the blog carried `noIndex` and a
 * sitemap exclusion for exactly that reason. Restoring them behind a fallback
 * would reinstate the problem in a place nobody looks.
 *
 * With no fallback, an unreachable API yields an empty blog — which is honest,
 * and which the pages render as an empty state rather than as an article
 * nobody wrote.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface BlogPostSummary {
  title: string;
  slug: string;
  excerpt: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  content: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  tags: { name: string; slug: string }[];
  related: BlogPostSummary[];
}

/** The API answers a retired slug with the current one instead of a post. */
interface Redirect {
  redirectTo: string;
}

export interface BlogPage {
  posts: BlogPostSummary[];
  page: number;
  totalPages: number;
  total: number;
}

const EMPTY: BlogPage = { posts: [], page: 1, totalPages: 0, total: 0 };

export async function getBlogPage(
  page = 1,
  filters: { q?: string; category?: string; tag?: string } = {},
): Promise<BlogPage> {
  return loadContent({
    label: `blog?page=${page}`,
    fromApi: async (api) => {
      const result = await api.get<Paginated<BlogPostSummary>>('blog', {
        query: { page, limit: 12, ...filters },
        ...publicCache('blog'),
      });
      return {
        posts: result.items,
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        total: result.pagination.total,
      };
    },
    fallback: () => EMPTY,
  });
}

/**
 * One post, or a redirect, or null.
 *
 * Three outcomes rather than two because a renamed article must not 404: the
 * API resolves a retired slug through `slug_history` and returns the current
 * one, and the page issues a permanent redirect to it.
 */
export async function getBlogPost(
  slug: string,
): Promise<BlogPostDetail | { redirectTo: string } | null> {
  return loadContent({
    label: `blog/${slug}`,
    fromApi: async (api) => {
      try {
        const post = await api.get<BlogPostDetail | Redirect>(`blog/${slug}`, {
          ...publicCache('blog'),
        });
        return 'redirectTo' in post ? { redirectTo: post.redirectTo } : post;
      } catch (error) {
        // A draft, an archived post and a slug that never existed are all
        // "not found" here — the API does not distinguish them, and neither
        // should this, or the 404 becomes an oracle for unpublished work.
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    fallback: () => null,
  });
}

/** Categories that carry at least one published post. */
export async function getBlogCategories(): Promise<{ name: string; slug: string }[]> {
  return loadContent({
    label: 'blog/categories',
    fromApi: async (api) =>
      api.get<{ name: string; slug: string }[]>('blog/categories', { ...publicCache('blog') }),
    fallback: () => [],
  });
}

/** Published posts for the sitemap. Drafts and archived posts never appear. */
export async function getBlogSitemapEntries(): Promise<BlogPostSummary[]> {
  const collected: BlogPostSummary[] = [];
  let page = 1;
  let totalPages = 1;

  /*
    PAGED THROUGH, not asked for a single large limit. The list endpoint caps
    `limit`, so "give me everything" silently truncates once the blog outgrows
    that cap — and a sitemap that silently stops listing articles is a bug
    nobody notices for months.
  */
  while (page <= totalPages && page <= 50) {
    const result = await getBlogPage(page);
    collected.push(...result.posts);
    totalPages = result.totalPages;
    page += 1;
  }

  return collected;
}
