import { hasEnded } from '@sailent/validation';

/**
 * A programme's OPEN campaigns, counted from a list of campaigns — for the
 * fixture fallback, where there is no API to count them.
 *
 * The same rule as the API's programme count and the listing's `status=open`:
 * active, and with no end date or one that has not passed (`hasEnded`, end of
 * the day in India time). Paused, completed and archived campaigns are not
 * open. A hand-typed number here would drift from the campaigns it describes;
 * this cannot.
 */
export function countOpenCampaigns(
  programSlug: string,
  campaigns: readonly { programSlug: string; status: string; endsAt: string | null }[],
  now: Date = new Date(),
): number {
  return campaigns.filter(
    (campaign) =>
      campaign.programSlug === programSlug &&
      campaign.status === 'active' &&
      !hasEnded(campaign.endsAt, now),
  ).length;
}
