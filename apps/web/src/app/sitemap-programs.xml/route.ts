import { SITEMAP_HEADERS, loadSegment, renderUrlSet } from '@/lib/seo/sitemap-segments';

/** `/sitemap-programs.xml` — one segment of the sitemap index (docs/seo-strategy.md §6). */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return new Response(renderUrlSet(await loadSegment('programs')), { headers: SITEMAP_HEADERS });
}
