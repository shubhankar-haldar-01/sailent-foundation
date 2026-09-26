import 'server-only';

import { canonicalUrl } from './metadata';
import {
  getBlogSitemapEntries,
  getCampaigns,
  getEvents,
  getPrograms,
  getStories,
} from '@/lib/content';

/**
 * The sitemap, segmented behind an index.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `docs/seo-strategy.md` §6 specifies an index with one file per content type,
 * "so a large blog never delays discovery of a new campaign". Until now there
 * was a single `sitemap.ts` listing everything, which was right while there
 * were forty URLs and stops being right the moment the blog grows.
 *
 * WRITTEN AS ROUTE HANDLERS, not `MetadataRoute.Sitemap`. Next's sitemap
 * convention emits one `<urlset>` and has no way to express a
 * `<sitemapindex>`; `generateSitemaps()` shards into `/sitemap/0.xml`, which is
 * neither the structure the specification names nor one a human can read at a
 * glance. Six small handlers and an index give exactly the documented shape.
 *
 * NO `changefreq`, NO `priority`. §6 again: "Google ignores both, and guessing
 * at them adds noise." The previous sitemap carried hand-assigned priorities;
 * they are gone rather than carried forward.
 *
 * `lastmod` is the CONTENT'S own date wherever one exists. A build-time
 * timestamp on every URL trains crawlers to ignore the signal entirely, which
 * is worse than omitting it.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface SitemapEntry {
  url: string;
  lastModified: Date;
}

/**
 * Static pages worth indexing.
 *
 * Deliberately excluded, and each for its own reason: `/search` is thin and
 * duplicative, `/admin` and `/account` are private, `/donate/checkout` and
 * `/donate/status` are transactional and can carry a donation reference in the
 * URL. `robots.txt` disallows the same set — the two must not disagree.
 */
const STATIC_ROUTES = [
  '/',
  '/about',
  '/team',
  '/programs',
  '/campaigns',
  '/impact',
  '/stories',
  '/blog',
  '/volunteer',
  '/events',
  '/contact',
  '/faq',
  '/donate',
  '/privacy-policy',
  '/terms',
  '/donation-policy',
] as const;

/** The segments, in the order the index lists them. */
export const SITEMAP_SEGMENTS = [
  'pages',
  'programs',
  'campaigns',
  'stories',
  'blog',
  'events',
] as const;

export type SitemapSegment = (typeof SITEMAP_SEGMENTS)[number];

export function segmentUrl(segment: SitemapSegment): string {
  return canonicalUrl(`/sitemap-${segment}.xml`);
}

/**
 * One segment's URLs.
 *
 * Each loader reads the same content layer the pages render from, so a record
 * that is not public cannot reach the sitemap: the public endpoints filter to
 * published rows in SQL, and nothing here widens that.
 */
export async function loadSegment(segment: SitemapSegment): Promise<SitemapEntry[]> {
  const now = new Date();

  switch (segment) {
    case 'pages':
      return STATIC_ROUTES.map((route) => ({ url: canonicalUrl(route), lastModified: now }));

    case 'programs': {
      const programs = await getPrograms();
      return programs.map((program) => ({
        url: canonicalUrl(`/programs/${program.slug}`),
        lastModified: now,
      }));
    }

    case 'campaigns': {
      const campaigns = await getCampaigns({ status: 'all' });
      // Archived campaigns are excluded (§6). They are history, not something
      // to send a searcher to.
      return campaigns
        .filter((campaign) => campaign.status !== 'archived')
        .map((campaign) => ({
          url: canonicalUrl(`/campaigns/${campaign.slug}`),
          lastModified: new Date(campaign.updates.at(-1)?.publishedAt ?? campaign.startsAt),
        }));
    }

    case 'stories': {
      const stories = await getStories();
      return stories.map((story) => ({
        url: canonicalUrl(`/stories/${story.slug}`),
        lastModified: new Date(story.publishedAt),
      }));
    }

    case 'blog': {
      // Published posts only — the loader reads the public list endpoint, which
      // pins `status = 'published'` in SQL, so a draft cannot appear here.
      const posts = await getBlogSitemapEntries();
      return posts.map((post) => ({
        url: canonicalUrl(`/blog/${post.slug}`),
        lastModified: new Date(post.updatedAt),
      }));
    }

    case 'events': {
      const [upcoming, past] = await Promise.all([getEvents('upcoming'), getEvents('past')]);
      const cutoff = Date.now() - 365 * 24 * 3600 * 1000;

      // Past events older than twelve months are dropped (§6): they are not
      // useful search results, and they dilute what is.
      return [...upcoming, ...past]
        .filter((event) => new Date(event.startsAt).getTime() > cutoff)
        .map((event) => ({
          url: canonicalUrl(`/events/${event.slug}`),
          lastModified: new Date(event.startsAt),
        }));
    }
  }
}

/**
 * XML escaping for a URL.
 *
 * Slugs are lowercase words and hyphens today, so this is belt and braces —
 * but a sitemap is machine-read, and one unescaped `&` from a future slug or a
 * query string makes the whole document unparseable rather than the one entry
 * wrong.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A `<urlset>` document for one segment. */
export function renderUrlSet(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n` +
        `    <lastmod>${entry.lastModified.toISOString()}</lastmod>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** The `<sitemapindex>` document. */
export function renderIndex(segments: { url: string; lastModified: Date }[]): string {
  const entries = segments
    .map(
      (segment) =>
        `  <sitemap>\n    <loc>${escapeXml(segment.url)}</loc>\n` +
        `    <lastmod>${segment.lastModified.toISOString()}</lastmod>\n  </sitemap>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

/**
 * The most recent `lastmod` in a segment, for the index.
 *
 * An index entry's `lastmod` should say when that segment last changed, so a
 * crawler can skip a file it has already seen. Falling back to now for an empty
 * segment is honest: there is nothing in it to date.
 */
export function newestOf(entries: SitemapEntry[]): Date {
  return entries.reduce<Date>(
    (newest, entry) => (entry.lastModified > newest ? entry.lastModified : newest),
    new Date(0),
  );
}

/** Shared response headers. Cached, because a sitemap is read by robots. */
export const SITEMAP_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
} as const;
