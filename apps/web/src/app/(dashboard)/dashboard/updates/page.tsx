import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, formatDate, formatNumber } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { MediaFrame } from '@/components/media/media-frame';
import { donorFetch, type DonorUpdate, type Paginated } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Updates',
  path: '/dashboard/updates',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * News from the work this donor funded.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOT A NOTIFICATION INBOX, AND IT DOES NOT PRETEND TO BE ONE.
 *
 * There is no unread state, no badge and no "mark as read", because there is no
 * table behind them — and inventing one to hold a boolean would be a bigger
 * commitment than this screen earns. What the data genuinely supports is a
 * reverse-chronological list of published impact updates from campaigns this
 * donor actually funded, so that is exactly what this is.
 *
 * EVERY FIGURE IS A RECORDED ONE. Where an update carries a metric it is shown
 * with its unit as the field says; where it does not, nothing is shown. No
 * figure on this page is derived from the donation (decision A14).
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page ?? '1') || 1);
  const result = await donorFetch<Paginated<DonorUpdate>>('me/updates', {
    query: { page, limit: 10 },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h1 font-bold">Updates</h1>
        <p className="text-body text-muted-foreground mt-2">
          What has happened on the campaigns you funded.
        </p>
      </header>

      {result.items.length === 0 ? (
        <EmptyState
          title="No updates yet"
          description="When a campaign you have funded publishes a report from the field, it will appear here."
          action={{ label: 'See all impact', href: '/impact' }}
        />
      ) : (
        <ul className="space-y-5">
          {result.items.map((update) => {
            const image = update.images?.[0];

            return (
              <li key={update.id}>
                <Card className="overflow-hidden">
                  {image ? (
                    <MediaFrame
                      media={{
                        seed: image.seed ?? update.id,
                        alt: image.alt ?? '',
                        ...(image.url ? { url: image.url } : {}),
                      }}
                      aspect="landscape"
                      rounded={false}
                      sizes="(max-width: 1024px) 100vw, 640px"
                    />
                  ) : null}

                  <div className="p-5">
                    {update.campaignSlug ? (
                      <p className="text-caption text-muted-foreground">
                        <Link
                          href={`/campaigns/${update.campaignSlug}`}
                          className="focus-visible:outline-ring rounded-sm font-medium hover:underline focus-visible:outline-2"
                        >
                          {update.campaignTitle}
                        </Link>
                      </p>
                    ) : null}

                    <h2 className="text-h3 mt-1 font-semibold">{update.title}</h2>

                    <p className="text-caption text-muted-foreground mt-1">
                      {formatDate(update.impactDate ?? update.publishedAt)}
                      {update.location ? ` · ${update.location}` : ''}
                      {update.state ? `, ${update.state}` : ''}
                    </p>

                    {update.description ? (
                      <p className="text-body text-muted-foreground mt-3 leading-relaxed">
                        {update.description}
                      </p>
                    ) : null}

                    {/* Shown only when the record actually carries one. */}
                    {update.metricValue !== null && update.metricUnit ? (
                      <p className="border-border mt-4 border-t pt-4">
                        <span data-numeric="" className="text-h3 font-bold tabular-nums">
                          {formatNumber(update.metricValue)}
                        </span>{' '}
                        <span className="text-body-sm text-muted-foreground">
                          {update.metricUnit}
                        </span>
                      </p>
                    ) : null}
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
              href={`/dashboard/updates?page=${page - 1}`}
              className="text-body-sm text-info-action rounded-sm font-semibold underline underline-offset-4"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-caption text-muted-foreground">
            Page {page} of {result.pagination.totalPages}
          </span>
          {result.pagination.hasNext ? (
            <Link
              href={`/dashboard/updates?page=${page + 1}`}
              className="text-body-sm text-info-action rounded-sm font-semibold underline underline-offset-4"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
