import { FeaturedCampaigns } from '@/components/home/featured-campaigns';
import type { DonorViewer } from '@/lib/donor/viewer';
import type { Campaign } from '@/lib/mock/types';

/**
 * The homepage's featured campaigns band.
 *
 * It used to pair the band with the focus-area strip under the hero, whose
 * tiles narrowed the band in place, and held which area was chosen. The strip
 * was taken off the homepage at the client's request, so there is no longer a
 * choice to hold and the band always shows its featured campaigns. Filtering
 * by cause lives in the campaigns grid further down the homepage and on
 * /campaigns.
 *
 * Kept as the band's entry point because both the page's own order and the
 * section composer render it by this name.
 */
export function CampaignBrowser({
  campaigns,
  viewer,
}: {
  campaigns: Campaign[];
  /** Passed through to the cards' save hearts. */
  viewer?: DonorViewer;
}) {
  return <FeaturedCampaigns campaigns={campaigns} {...(viewer ? { viewer } : {})} />;
}
