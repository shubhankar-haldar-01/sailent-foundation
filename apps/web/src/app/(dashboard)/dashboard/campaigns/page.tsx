import type { Metadata } from 'next';
import Link from 'next/link';

import { CampaignProgress, Card, formatCurrency, formatDate } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { donorFetch, type Paginated, type SupportedCampaign } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Campaigns you support',
  path: '/dashboard/campaigns',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Campaigns this donor has funded.
 *
 * TWO NUMBERS THAT MUST NOT BE CONFUSED: what this donor gave, and what the
 * campaign has raised in total. They sit next to each other, so each is
 * labelled explicitly rather than left to position and colour. "You gave" is
 * the donor's own figure, summed from their own donations.
 *
 * CONFIRMED DONATIONS ONLY. A pending or failed attempt is not support, and
 * listing it here would tell somebody they had funded something they had not.
 */
export default async function SupportedCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page ?? '1') || 1);
  const result = await donorFetch<Paginated<SupportedCampaign>>('me/campaigns', {
    query: { page, limit: 20 },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Campaigns you support</h1>
        <p className="text-body text-muted-foreground mt-2">
          {result.pagination.total === 0
            ? 'The campaigns you fund will be listed here.'
            : `${result.pagination.total} ${result.pagination.total === 1 ? 'campaign' : 'campaigns'} you have funded.`}
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          title="You have not funded a campaign yet"
          description="Once a donation is confirmed, the campaign it went to appears here with your own contribution."
          action={{ label: 'Browse campaigns', href: '/campaigns' }}
        />
      ) : (
        <ul className="space-y-4">
          {result.items.map((campaign) => {
            const goal = campaign.fundraisingGoal ?? 0;

            return (
              <li key={campaign.campaignId}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-h3 font-semibold">
                        <Link
                          href={`/campaigns/${campaign.slug}`}
                          className="focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {campaign.title}
                        </Link>
                      </h2>
                      <p className="text-caption text-muted-foreground mt-1">
                        {campaign.donationCount}{' '}
                        {campaign.donationCount === 1 ? 'donation' : 'donations'} · last on{' '}
                        {formatDate(campaign.lastDonatedAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-caption text-muted-foreground">You gave</p>
                      <p data-numeric="" className="text-h3 font-bold tabular-nums">
                        {formatCurrency(Number(campaign.contributed))}
                      </p>
                    </div>
                  </div>

                  {goal > 0 ? (
                    <div className="mt-4">
                      {/*
                        The CAMPAIGN's totals, clearly separated from "You gave"
                        above. Two figures that mean different things sitting
                        next to each other is the one thing this page must not
                        blur, so each is labelled rather than left to position.
                      */}
                      <p className="text-caption text-muted-foreground mb-2">
                        This campaign altogether
                      </p>
                      <CampaignProgress raised={campaign.amountRaised} goal={goal} size="sm" />
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {result.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link
              href={`/dashboard/campaigns?page=${page - 1}`}
              className="text-body-sm text-info-action rounded-sm font-semibold underline underline-offset-4"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-caption text-muted-foreground">
            Page {page} of {result.pagination.totalPages}
          </span>
          {result.pagination.hasNext ? (
            <Link
              href={`/dashboard/campaigns?page=${page + 1}`}
              className="text-body-sm text-info-action rounded-sm font-semibold underline underline-offset-4"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
