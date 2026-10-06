/**
 * Which campaigns lead the homepage's Featured Campaigns band, and in what
 * order.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ADMINISTRATOR DECIDES.
 *
 * A campaign is featured when someone ticks "Feature on the homepage" on its
 * admin form, and its "Featured order" sets its place (lowest first). The
 * band shows, in order:
 *   1. the featured campaigns, by featured order — a featured campaign with no
 *      number goes after the numbered ones;
 *   2. then every other campaign, deadline soonest first, so the band is never
 *      empty and what fills it is what most needs support now;
 *   3. a campaign with no deadline after those that have one.
 *
 * ONLY CAMPAIGNS TAKING DONATIONS: active, and not past an end date. A paused
 * campaign, or one whose deadline has gone, cannot take a donation, so it has
 * no place in a band whose every card says "Donate Now". It still appears on
 * the campaigns page, badged as closed.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The API applies this order itself (`sort=featured`) and its order is used
 * as sent. `orderFeaturedFirst` is the same rule for the development
 * fixtures, which have no API behind them — and the one place it is written
 * down for both.
 */

import { hasEnded } from '@sailent/validation';

/** How many cards the band carries. Four on screen at desktop; it scrolls through the rest. */
export const FEATURED_BAND_SIZE = 12;

export interface FeaturedCandidate {
  status: string;
  isFeatured: boolean;
  /** Absent on the fixtures and the public list; the API orders by it before sending. */
  featuredOrder?: number | null;
  endsAt: string | null;
}

/** Milliseconds, or +Infinity for "no deadline" so it sorts last. */
function deadline(endsAt: string | null): number {
  if (!endsAt) return Number.POSITIVE_INFINITY;
  const time = new Date(endsAt).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/**
 * Active campaigns, featured first, then by deadline. Never mutates its input,
 * and keeps the incoming order between campaigns the rule cannot tell apart.
 */
export function orderFeaturedFirst<T extends FeaturedCandidate>(
  campaigns: readonly T[],
  limit = FEATURED_BAND_SIZE,
): T[] {
  return campaigns
    .filter((campaign) => campaign.status === 'active' && !hasEnded(campaign.endsAt))
    .map((campaign, index) => ({ campaign, index }))
    .sort((a, b) => {
      if (a.campaign.isFeatured !== b.campaign.isFeatured) return a.campaign.isFeatured ? -1 : 1;
      if (a.campaign.isFeatured) {
        const byOrder =
          (a.campaign.featuredOrder ?? Number.POSITIVE_INFINITY) -
          (b.campaign.featuredOrder ?? Number.POSITIVE_INFINITY);
        if (byOrder !== 0 && !Number.isNaN(byOrder)) return byOrder;
      }
      const byDeadline = deadline(a.campaign.endsAt) - deadline(b.campaign.endsAt);
      if (byDeadline !== 0 && !Number.isNaN(byDeadline)) return byDeadline;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map(({ campaign }) => campaign);
}
