import type { Metadata } from 'next';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { SearchPanel } from '@/components/search/search-panel';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Search',
  path: '/search',
  // Search result pages are thin and duplicative; they are not indexed.
  noIndex: true,
});

export default function SearchPage() {
  return (
    <>
      <PageHero eyebrow="Search" title="Find something" />
      <Section>
        <PageShell>
          <SearchPanel />
        </PageShell>
      </Section>
    </>
  );
}
