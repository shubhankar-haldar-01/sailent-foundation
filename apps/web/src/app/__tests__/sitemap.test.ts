import { describe, expect, it, vi } from 'vitest';

/**
 * The sitemap must advertise real content, only real content, and say where
 * each segment lives.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THIS FILE HAS NOW ASSERTED THREE DIFFERENT THINGS ABOUT THE BLOG, AND THE
 * SEQUENCE IS THE HISTORY OF THE FEATURE.
 *
 *   1. No blog URL may appear — the posts were fabricated (`lib/mock/blog.ts`).
 *   2. Published posts must appear — Phase 10.7 made them real records.
 *   3. And now: they appear in their OWN segment, behind an index.
 *
 * Decision A14 is unchanged throughout — no public claim without a record
 * behind it. A sitemap entry is the strongest claim the site makes about a URL.
 *
 * Phase 10.8 splits the single `<urlset>` into the six files
 * `docs/seo-strategy.md` §6 specifies, so a growing blog cannot delay discovery
 * of a new campaign.
 * ══════════════════════════════════════════════════════════════════════════
 */

const PUBLISHED_POSTS = [
  { slug: 'what-a-school-kit-costs', updatedAt: '2026-02-01T00:00:00.000Z' },
  { slug: 'why-we-stopped-a-program', updatedAt: '2026-03-01T00:00:00.000Z' },
];

vi.mock('@/lib/content', () => ({
  getCampaigns: async () => [
    {
      slug: 'a-real-campaign',
      status: 'active',
      startsAt: '2026-01-01T00:00:00.000Z',
      updates: [],
    },
    // Archived campaigns are excluded by §6 — history, not a destination.
    {
      slug: 'an-archived-campaign',
      status: 'archived',
      startsAt: '2025-01-01T00:00:00.000Z',
      updates: [],
    },
  ],
  getPrograms: async () => [{ slug: 'a-real-program' }],
  getStories: async () => [{ slug: 'a-real-story', publishedAt: '2026-01-01T00:00:00.000Z' }],
  getEvents: async (when: string) =>
    when === 'upcoming'
      ? [{ slug: 'an-upcoming-event', startsAt: '2026-12-01T00:00:00.000Z' }]
      : [
          {
            slug: 'a-recent-event',
            startsAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
          },
          // Older than twelve months: dropped by §6.
          { slug: 'an-ancient-event', startsAt: '2019-01-01T00:00:00.000Z' },
        ],
  getBlogSitemapEntries: async () => PUBLISHED_POSTS,
}));

const { SITEMAP_SEGMENTS, loadSegment, renderIndex, renderUrlSet, newestOf, segmentUrl } =
  await import('@/lib/seo/sitemap-segments');

const urlsIn = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);

describe('sitemap segments', () => {
  it('puts every published blog post in the blog segment, and nowhere else', async () => {
    const blog = urlsIn(renderUrlSet(await loadSegment('blog')));

    for (const post of PUBLISHED_POSTS) {
      expect(blog.some((url) => url.endsWith(`/blog/${post.slug}`))).toBe(true);
    }
    expect(blog).toHaveLength(PUBLISHED_POSTS.length);

    // A blog post must not leak into another segment.
    for (const segment of SITEMAP_SEGMENTS.filter((s) => s !== 'blog' && s !== 'pages')) {
      expect(urlsIn(renderUrlSet(await loadSegment(segment))).join(' ')).not.toContain('/blog/');
    }
  });

  it('lists only what its source returned — it never invents or widens', async () => {
    // If a segment ever listed something the loader did not hand it, that is
    // the bug that puts a draft on the internet.
    const blog = urlsIn(renderUrlSet(await loadSegment('blog')));
    expect(blog.some((url) => url.includes('a-draft-nobody-approved'))).toBe(false);
  });

  it('excludes archived campaigns', async () => {
    const campaigns = urlsIn(renderUrlSet(await loadSegment('campaigns')));
    expect(campaigns.some((url) => url.endsWith('/campaigns/a-real-campaign'))).toBe(true);
    expect(campaigns.some((url) => url.endsWith('/campaigns/an-archived-campaign'))).toBe(false);
  });

  it('drops past events older than twelve months, and keeps the rest', async () => {
    const events = urlsIn(renderUrlSet(await loadSegment('events')));
    expect(events.some((url) => url.endsWith('/events/an-upcoming-event'))).toBe(true);
    expect(events.some((url) => url.endsWith('/events/a-recent-event'))).toBe(true);
    expect(events.some((url) => url.endsWith('/events/an-ancient-event'))).toBe(false);
  });

  it('lists the public pages, and none of the private or transactional ones', async () => {
    const pages = urlsIn(renderUrlSet(await loadSegment('pages')));

    expect(pages.some((url) => url.endsWith('/blog'))).toBe(true);
    expect(pages.some((url) => url.endsWith('/campaigns'))).toBe(true);

    // The same set robots.txt disallows. The two must not disagree.
    for (const forbidden of [
      '/admin',
      '/account',
      '/search',
      '/donate/checkout',
      '/donate/status',
    ]) {
      expect(pages.some((url) => url.includes(forbidden))).toBe(false);
    }
  });

  it('gives every entry an absolute URL and a real date', async () => {
    for (const segment of SITEMAP_SEGMENTS) {
      const xml = renderUrlSet(await loadSegment(segment));
      for (const url of urlsIn(xml)) expect(url, url).toMatch(/^https?:\/\//);
      for (const [, stamp] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
        expect(Number.isNaN(Date.parse(stamp!)), stamp).toBe(false);
      }
    }
  });

  it('omits changefreq and priority, which §6 says are noise', async () => {
    const xml = renderUrlSet(await loadSegment('campaigns'));
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });

  it('escapes XML so one awkward slug cannot break the document', () => {
    const xml = renderUrlSet([
      { url: 'https://example.org/blog/a&b<c>', lastModified: new Date('2026-01-01') },
    ]);
    expect(xml).toContain('&amp;');
    expect(xml).not.toMatch(/<loc>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

describe('the sitemap index', () => {
  it('names all six segments', async () => {
    const index = renderIndex(
      await Promise.all(
        SITEMAP_SEGMENTS.map(async (segment) => ({
          url: segmentUrl(segment),
          lastModified: newestOf(await loadSegment(segment)),
        })),
      ),
    );

    expect(index).toContain('<sitemapindex');
    for (const segment of SITEMAP_SEGMENTS) {
      expect(index).toContain(`/sitemap-${segment}.xml`);
    }
    // An index points at files, never at pages.
    expect(index).not.toContain('<url>');
  });

  it('dates each segment by its own newest entry, not by the build', async () => {
    // A build-time lastmod on every URL trains crawlers to ignore the signal.
    const blog = await loadSegment('blog');
    expect(newestOf(blog).toISOString()).toBe(PUBLISHED_POSTS[1]!.updatedAt);
  });
});
