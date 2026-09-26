import {
  SITEMAP_HEADERS,
  SITEMAP_SEGMENTS,
  loadSegment,
  newestOf,
  renderIndex,
  segmentUrl,
} from '@/lib/seo/sitemap-segments';

/**
 * `/sitemap.xml` — the INDEX, not a list of URLs.
 *
 * `docs/seo-strategy.md` §6. Each segment is dated by its own newest entry, so
 * a crawler can skip a file that has not changed instead of re-reading every
 * URL on the site to discover one new campaign.
 *
 * Replaces `app/sitemap.ts`, which emitted a single `<urlset>` containing
 * everything. Next's sitemap convention cannot express a `<sitemapindex>`.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  const segments = await Promise.all(
    SITEMAP_SEGMENTS.map(async (segment) => ({
      url: segmentUrl(segment),
      lastModified: newestOf(await loadSegment(segment)),
    })),
  );

  return new Response(renderIndex(segments), { headers: SITEMAP_HEADERS });
}
