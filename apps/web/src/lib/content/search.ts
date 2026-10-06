import 'server-only';

import { searchContent } from '@/lib/mock';

import { loadContent } from './source';

export type SearchType = 'campaign' | 'program' | 'story' | 'event' | 'blog';

export interface SearchHit {
  type: SearchType;
  title: string;
  excerpt: string | null;
  href: string;
}

/**
 * Site search (Phase 13): the API searches PUBLISHED content only — never a
 * draft, archived or deleted record. Until Phase 13 this searched the
 * development fixtures in the browser, which in production would have offered
 * records that do not exist. Fixtures remain only as the development fallback.
 */
export async function searchSite(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return loadContent<SearchHit[]>({
    label: 'search',
    fromApi: async (api) =>
      (
        await api.get<{ results: SearchHit[] }>('search', {
          query: { q: q.slice(0, 100) },
          cache: 'no-store',
        })
      ).results,
    fallback: () =>
      searchContent(q).map((record) => ({
        type: record.type,
        title: record.title,
        excerpt: record.excerpt,
        href: record.href,
      })),
  });
}
