import Link from 'next/link';
import type { Metadata } from 'next';
import { Button, SectionHeader } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignFilters } from '@/components/campaigns/campaign-filters';
import { categoryKey } from '@/lib/categories';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCampaignFilters, getCampaigns, getFeaturedCampaign, getPrograms } from '@/lib/content';

export const metadata: Metadata = buildMetadata({
  title: 'Campaigns',
  description:
    'Fund a specific thing — a school kit, a clinic day, a month of nutrition support — or give any amount to a campaign.',
  path: '/campaigns',
});

/**
 * `?category=<slug>` arrives from the homepage's focus-area strip.
 *
 * Reading it here is what makes "View all <area> campaigns" mean anything. The
 * strip has linked to this page with a category for some time and the page
 * ignored it entirely, so the link went to an unfiltered listing and looked
 * broken in a way nothing reported.
 */
export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  // Fetched together rather than in sequence: four independent reads awaited
  // one after another would make the page as slow as their sum.
  const [featured, campaigns, programs, filters] = await Promise.all([
    getFeaturedCampaign(),
    getCampaigns(),
    getPrograms(),
    getCampaignFilters(),
  ]);

  /*
    THE FEATURED BLOCK STANDS DOWN WHEN A CATEGORY IS ASKED FOR.

    It is a hand-picked campaign shown above the listing, and it ignored the
    filter — so arriving from "View all Education campaigns" put a Disaster
    Relief appeal at the top of the page, above the education ones. That reads
    as the filter being broken.

    With a category in play the promotion is dropped and every campaign,
    including that one, goes through the filter instead. Without one, nothing
    changes.
  */
  /*
    Resolved, not merely present.

    Keying this off `Boolean(category)` meant a stale or mistyped slug
    suppressed the promotion while the list fell back to showing everything —
    two halves of the page disagreeing about whether a filter was on.
  */
  const resolvedCategory = category
    ? (filters.categories.find((name) => categoryKey(name) === categoryKey(category)) ?? null)
    : null;
  const promoted = resolvedCategory ? null : featured;
  const rest = promoted
    ? campaigns.filter((campaign) => campaign.slug !== promoted.slug)
    : campaigns;

  return (
    <>
      <PageHero
        eyebrow="Campaigns"
        title="Fund something specific"
        lead="Each campaign states what it needs, what it has raised so far, and what happens to money beyond the goal. Where there is a deadline, it is a real one."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Campaigns', path: '/campaigns' },
            ]}
          />

          {promoted ? (
            <div className="mb-14">
              <SectionHeader eyebrow="Featured" title={promoted.title} as="h2" />
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <CampaignCard campaign={promoted} className="lg:col-span-2" />
                <div className="border-border bg-surface-sunken flex flex-col justify-center gap-4 rounded-lg border p-6">
                  <p className="text-body text-muted-foreground">{promoted.shortDescription}</p>
                  <p className="text-body-sm text-muted-foreground">
                    {promoted.beneficiaryContext}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button asChild>
                      <Link href={`/campaigns/${promoted.slug}#give`}>Donate to this campaign</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/campaigns/${promoted.slug}`}>Read more</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <h2 className="sr-only">All campaigns</h2>
          <CampaignFilters
            campaigns={rest}
            programs={programs.map((program) => ({ slug: program.slug, name: program.name }))}
            categories={filters.categories}
            locations={filters.locations}
            initialCategory={category ?? null}
          />
        </PageShell>
      </Section>
    </>
  );
}
