import { PageShell } from '@/components/layout/page-shell';
import { CampaignsHero } from '@/components/campaigns/campaigns-hero';
import {
  CampaignListingSkeleton,
  CampaignSearchBarSkeleton,
} from '@/components/campaigns/listing-skeleton';

/**
 * Arriving at /campaigns from another page.
 *
 * The hero is static, so it is drawn for real rather than as grey blocks — the
 * page appears at once and only the parts that wait on the API show as
 * loading. Same structure and spacing as `page.tsx`, so nothing moves when the
 * real page replaces this.
 */
export default function LoadingCampaigns() {
  return (
    <>
      <CampaignsHero />

      <PageShell className="relative z-10 -mt-7">
        <div className="mx-auto max-w-4xl">
          <CampaignSearchBarSkeleton />
        </div>
      </PageShell>

      <div className="pb-16 pt-8 md:pb-20">
        <PageShell>
          <div className="max-w-(--container-wide) mx-auto">
            <CampaignListingSkeleton />
          </div>
        </PageShell>
      </div>
    </>
  );
}
