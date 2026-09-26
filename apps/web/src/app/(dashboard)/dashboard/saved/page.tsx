import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Button, CampaignProgress, Card, formatDate } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { UnsaveButton } from '@/components/dashboard/save-campaign-button';
import { donorFetch, type Paginated, type SavedCampaign } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Saved campaigns',
  path: '/dashboard/saved',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * Campaigns saved to come back to.
 *
 * A SAVE FOLLOWS THE CAMPAIGN rather than freezing it. Unlike a donation line,
 * which snapshots the price that was charged, a bookmark is a pointer: somebody
 * who saved an appeal wants its progress today, not its progress on the day
 * they saved it.
 *
 * A saved campaign that has since been paused or completed STAYS in the list,
 * labelled. Quietly removing it would leave someone wondering where it went;
 * saying "this has finished" answers the question.
 */
export default async function SavedCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page ?? '1') || 1);
  const result = await donorFetch<Paginated<SavedCampaign>>('me/saved-campaigns', {
    query: { page, limit: 20 },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Saved campaigns</h1>
        <p className="text-body text-muted-foreground mt-2">
          Campaigns you have kept to come back to.
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Save a campaign from its page and it will be waiting here when you are ready."
          action={{ label: 'Browse campaigns', href: '/campaigns' }}
        />
      ) : (
        <ul className="space-y-4">
          {result.items.map((campaign) => {
            const closed = campaign.status === 'completed' || campaign.status === 'archived';
            const paused = campaign.status === 'paused';

            return (
              <li key={campaign.campaignId}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-h3 font-semibold">
                        <Link
                          href={`/campaigns/${campaign.slug}`}
                          className="focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {campaign.title}
                        </Link>
                      </h2>
                      {campaign.shortDescription ? (
                        <p className="text-body-sm text-muted-foreground mt-1.5 line-clamp-2">
                          {campaign.shortDescription}
                        </p>
                      ) : null}
                      <p className="text-caption text-muted-foreground mt-1.5">
                        Saved {formatDate(campaign.savedAt)}
                      </p>
                    </div>

                    <UnsaveButton campaignId={campaign.campaignId} title={campaign.title} />
                  </div>

                  {campaign.fundraisingGoal ? (
                    <CampaignProgress
                      raised={campaign.amountRaised}
                      goal={campaign.fundraisingGoal}
                      size="sm"
                      className="mt-4"
                    />
                  ) : null}

                  <div className="mt-4">
                    {closed ? (
                      <p className="text-body-sm text-muted-foreground">
                        This campaign has finished. Thank you for following it.
                      </p>
                    ) : paused ? (
                      <p className="text-body-sm text-muted-foreground">
                        This campaign is paused and is not accepting donations right now.
                      </p>
                    ) : (
                      <Button asChild size="md">
                        <Link href={`/campaigns/${campaign.slug}/donate`}>
                          Donate
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </Button>
                    )}
                  </div>
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
              href={`/dashboard/saved?page=${page - 1}`}
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
              href={`/dashboard/saved?page=${page + 1}`}
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
