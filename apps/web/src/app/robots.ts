import type { MetadataRoute } from 'next';

import { siteConfig } from '@/lib/site-config';

/**
 * robots.txt (docs/seo-strategy.md §6).
 *
 * Transactional and private routes are disallowed: indexing them wastes crawl
 * budget and can expose donation reference numbers in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      /*
        The same set `sitemap-segments.ts` excludes from the sitemap. The two
        must not disagree: a URL advertised in one and forbidden in the other
        is a contradiction a crawler resolves by trusting neither.

        `/volunteer/portal/` is listed by docs/seo-strategy.md §6 and was
        missing here. The route does not exist yet — disallowing it now costs
        nothing and means the day it does exist it is not indexed before
        anybody remembers this file.
      */
      disallow: [
        '/admin/',
        '/account/',
        '/volunteer/portal/',
        '/api/',
        '/donate/checkout',
        '/donate/status/',
        '/search',
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
