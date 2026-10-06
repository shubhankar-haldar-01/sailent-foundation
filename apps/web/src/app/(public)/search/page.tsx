import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { SearchPanel } from '@/components/search/search-panel';
import { buildMetadata } from '@/lib/seo/metadata';
import { searchSite } from '@/lib/content/search';

export const metadata: Metadata = buildMetadata({
  title: 'Search',
  path: '/search',
  // Search result pages are thin and duplicative; they are not indexed.
  noIndex: true,
});

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  const results = await searchSite(query);

  return (
    <>
      <PageHero eyebrow="Search" title="Find something" />
      <Section>
        <PageShell>
          <SearchPanel key={query} query={query} results={results} />
        </PageShell>
      </Section>
    </>
  );
}
