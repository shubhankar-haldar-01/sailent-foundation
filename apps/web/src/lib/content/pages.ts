import 'server-only';

import type { PageSection } from '@sailent/validation';

import { loadContent, publicCache } from './source';

/**
 * Composed pages, from the API.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE FALLBACK IS `null`, AND THAT IS THE WHOLE DESIGN.
 *
 * A page that returns null means "nothing composed" — and every route that
 * uses this renders its own canonical order instead. So an empty table, an
 * unreachable API, a page somebody archived by mistake, or a schedule that has
 * not arrived all produce the same safe outcome: the site looks like itself.
 *
 * A composer must not be able to take the homepage down.
 * ══════════════════════════════════════════════════════════════════════════
 */
export interface ComposedPage {
  slug: string;
  title: string;
  sections: PageSection[];
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

/**
 * The published composition for a route, or null.
 *
 * `preview` carries a signed token from the admin UI; the API verifies it and
 * only then returns an unpublished page. Nothing here decides that.
 */
export async function getComposedPage(
  slug: string,
  preview?: string,
): Promise<ComposedPage | null> {
  return loadContent({
    label: `pages/${slug}`,
    fromApi: async (api) => {
      try {
        return await api.get<ComposedPage>(`pages/${slug}`, {
          ...(preview ? { query: { preview } } : {}),
          /*
            A preview must never be cached: it is one editor looking at
            unpublished work, and a cached copy could be served to somebody
            else — or outlive the token that authorised it.
          */
          ...(preview ? { cache: 'no-store' as const } : publicCache(`page-${slug}`)),
        });
      } catch {
        // A missing, draft, archived or not-yet-scheduled page are all the same
        // answer here: compose nothing, and let the route render its own order.
        return null;
      }
    },
    fallback: () => null,
  });
}
