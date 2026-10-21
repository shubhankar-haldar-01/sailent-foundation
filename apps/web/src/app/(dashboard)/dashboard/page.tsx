import type { Metadata } from 'next';

import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { MyAccountNavCard } from '@/components/dashboard/my-account-nav-card';
import { RecentPayments } from '@/components/dashboard/recent-payments';
import {
  ExploreCard,
  FundedItemsCard,
  ImpactCard,
  ProfileCard,
} from '@/components/dashboard/side-cards';
import { StatCards } from '@/components/dashboard/stat-cards';
import { StayConnectedCard } from '@/components/dashboard/stay-connected-card';
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
      <div className="flex min-w-0 flex-col gap-5 xl:gap-4">
        {/* Welcome Greeting: MY ACCOUNT / Dashboard , [FirstName] */}
        <DashboardHero firstName={profile.firstName?.trim() || null} />

        {/*
          Phone only: the "My Account" card comes AFTER the welcome banner on
          this page (owner, 2026-10-17). The layout leaves it out here.
        */}
        <MyAccountNavCard className="lg:hidden" />

        {/* 3. Core Stat Cards: Total Donations & Campaigns Supported */}
        <StatCards impact={impact} />

        {/* 4. Recent Successful Payments */}
        <RecentPayments donations={recentDonations} />

        {/* 5. Continue your impact campaigns */}
        <SupportedCampaigns campaigns={campaigns} />

        {/* 6. Stay Connected / Updates in Inbox (bottom card) */}
        <StayConnectedCard />
      </div>
      <div className="hidden space-y-5 xl:block xl:space-y-4">
        <ProfileCard profile={profile} />
        <ImpactCard />
        <ExploreCard />
        <FundedItemsCard items={impact.itemsProvided} />
      </div>
    </div>
  );
}
