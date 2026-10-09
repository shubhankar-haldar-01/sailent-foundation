import type { Metadata } from 'next';

import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { RecentPayments } from '@/components/dashboard/recent-payments';
import {
  ExploreCard,
  FundedItemsCard,
  ImpactCard,
  ProfileCard,
} from '@/components/dashboard/side-cards';
import { StatCards } from '@/components/dashboard/stat-cards';
import { DASHBOARD_ROWS } from '@/components/dashboard/fit';
import { SupportedCampaigns } from '@/components/dashboard/supported-campaigns';
import { toMedia } from '@/lib/content/source';
import {
  donorFetch,
  type DonorOverview,
  type Paginated,
  type SupportedCampaign,
} from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your account',
  path: '/dashboard',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * The dashboard (design, 2026-10-08): the welcome banner, three figures,
 * recent payments and the campaigns supported in the centre; the profile,
 * "Your Impact" and "Explore More Campaigns" on the right. On a phone the
 * right column follows the centre, in that order.
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
  const [overview, supported] = await Promise.all([
    donorFetch<DonorOverview>('me/overview'),
    donorFetch<Paginated<SupportedCampaign>>('me/campaigns', {
      query: { page: 1, limit: DASHBOARD_ROWS },
    }),
  ]);
  const { profile, impact, recentDonations } = overview;

  const campaigns = supported.items.map((campaign) => ({
    ...campaign,
    cover: toMedia(campaign.coverImage, `campaign-${campaign.slug}`, campaign.title),
  }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18.5rem] xl:gap-5">
      <div className="min-w-0 space-y-5 xl:space-y-3">
        <DashboardHero firstName={profile.firstName?.trim() || null} />
        <StatCards impact={impact} />
        <RecentPayments donations={recentDonations} />
        <SupportedCampaigns campaigns={campaigns} />
      </div>
      <div className="space-y-5 xl:space-y-3">
        <ProfileCard profile={profile} />
        <ImpactCard />
        <ExploreCard />
        <FundedItemsCard items={impact.itemsProvided} />
      </div>
    </div>
  );
}
