import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Gift, Heart, Package } from 'lucide-react';

import { Button, Card, formatCurrency, formatDate } from '@sailent/ui';

import { StatusPill } from '@/components/dashboard/status-pill';
import { EmptyState } from '@/components/dashboard/empty-state';
import { donorFetch, type DonorOverview } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your account',
  path: '/dashboard',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * The dashboard landing page.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE ON THIS PAGE IS SUMMED FROM THIS DONOR'S OWN CONFIRMED
 * DONATIONS (decision A14).
 *
 * There is no "your gift fed 40 people" here, because no column in the database
 * says that. What it can say is how much was given, to how many campaigns, and
 * exactly which items were bought — and that is what it says. A dashboard that
 * flatters the donor with an invented number is the same failure as a campaign
 * page that does, and it is worse here because it is addressed to them
 * personally.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function DashboardPage() {
  const overview = await donorFetch<DonorOverview>('me/overview');
  const { profile, impact, recentDonations, savedCampaigns } = overview;

  const firstName = profile.firstName?.trim();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-h1 font-bold">{firstName ? `Hello, ${firstName}` : 'Your account'}</h1>
        <p className="text-body text-muted-foreground mt-2">
          {impact.donationCount > 0
            ? 'Everything you have given, and what it went to.'
            : 'Your giving will appear here once your first donation is confirmed.'}
        </p>
      </header>

      {/* Totals ------------------------------------------------------------ */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={Gift}
          label="Total given"
          value={formatCurrency(impact.totalGiven)}
          detail={`across ${impact.donationCount} ${impact.donationCount === 1 ? 'donation' : 'donations'}`}
        />
        <Stat
          icon={Heart}
          label="Campaigns funded"
          value={String(impact.campaignsSupported)}
          detail={impact.firstDonatedAt ? `since ${formatDate(impact.firstDonatedAt)}` : undefined}
        />
        <Stat
          icon={Package}
          label="Items provided"
          value={String(impact.itemsProvided.reduce((sum, item) => sum + item.quantity, 0))}
          detail={
            impact.itemsProvided.length > 0
              ? `${impact.itemsProvided.length} ${impact.itemsProvided.length === 1 ? 'kind' : 'kinds'}`
              : 'no item donations yet'
          }
        />
      </div>

      {/* What was bought --------------------------------------------------- */}
      {impact.itemsProvided.length > 0 ? (
        <section aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-h3 font-semibold">
            What you funded
          </h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Counted from your own donations — not a share of anyone else’s.
          </p>
          <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
            {impact.itemsProvided.map((item) => (
              <li
                key={item.itemName}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <span className="text-body-sm min-w-0 font-medium">{item.itemName}</span>
                <span data-numeric="" className="text-body-sm shrink-0 tabular-nums">
                  {item.quantity}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent donations -------------------------------------------------- */}
      <section aria-labelledby="recent-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recent-heading" className="text-h3 font-semibold">
            Recent donations
          </h2>
          {recentDonations.length > 0 ? (
            <Link
              href="/dashboard/donations"
              className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2"
            >
              See all
            </Link>
          ) : null}
        </div>

        {recentDonations.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No donations yet"
            description="When you give, it will show up here with its receipt."
            action={{ label: 'Browse campaigns', href: '/campaigns' }}
          />
        ) : (
          <ul className="border-border divide-border mt-4 divide-y rounded-lg border">
            {recentDonations.map((donation) => (
              <li key={donation.id}>
                <Link
                  href={`/dashboard/donations/${donation.id}`}
                  className="hover:bg-muted/50 focus-visible:outline-ring flex min-h-14 items-center justify-between gap-4 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <span className="min-w-0">
                    <span className="text-body-sm block truncate font-medium">
                      {donation.campaignTitle ?? 'General fund'}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {formatDate(donation.donationDate)} · {donation.reference}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusPill status={donation.status} />
                    <span data-numeric="" className="text-body-sm font-semibold tabular-nums">
                      {formatCurrency(donation.amount)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Saved ------------------------------------------------------------- */}
      {savedCampaigns.length > 0 ? (
        <section aria-labelledby="saved-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="saved-heading" className="text-h3 font-semibold">
              Saved for later
            </h2>
            <Link
              href="/dashboard/saved"
              className="text-body-sm text-info-action focus-visible:outline-ring rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:outline-2"
            >
              See all
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {savedCampaigns.map((campaign) => (
              <li key={campaign.campaignId}>
                <Card className="p-4">
                  <h3 className="text-body-sm font-semibold">
                    <Link
                      href={`/campaigns/${campaign.slug}`}
                      className="focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2"
                    >
                      {campaign.title}
                    </Link>
                  </h3>
                  <Button asChild size="sm" variant="secondary" className="mt-3">
                    <Link href={`/campaigns/${campaign.slug}/donate`}>
                      Donate
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-muted-foreground flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" />
        <span className="text-caption font-medium">{label}</span>
      </div>
      <p data-numeric="" className="text-h2 mt-2 font-bold tabular-nums">
        {value}
      </p>
      {detail ? <p className="text-caption text-muted-foreground mt-0.5">{detail}</p> : null}
    </Card>
  );
}
