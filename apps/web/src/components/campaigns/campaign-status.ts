import { CircleCheckBig, CirclePause, HandHeart, LayoutGrid, type LucideIcon } from 'lucide-react';

import type { CampaignStatusFilter } from './listing-query';

/**
 * How each campaign status LOOKS — its mark, its wash and its ink — in one
 * place, shared by the "Show" menu and the badge on each card.
 *
 * The menu and the cards must agree: someone who picks "Closed Campaigns" by
 * its amber pause mark should find that same amber pause mark on the cards it
 * returns. Kept out of the client-only menu module so the server-rendered card
 * can read it too.
 *
 * The washes are the palette the cause tiles already use. Each ink clears
 * 4.5:1 on white, which is what the card badge sits on.
 */
export const STATUS_VISUALS: Record<
  CampaignStatusFilter,
  { icon: LucideIcon; wash: string; ink: string; description: string }
> = {
  active: {
    icon: HandHeart,
    wash: 'bg-wash-mint',
    ink: 'text-wash-mint-ink-strong',
    description: 'Running now',
  },
  closed: {
    icon: CirclePause,
    wash: 'bg-wash-amber',
    ink: 'text-wash-amber-ink',
    description: 'Donations paused for now',
  },
  completed: {
    icon: CircleCheckBig,
    wash: 'bg-wash-blue',
    ink: 'text-wash-blue-ink',
    description: 'Finished, with results to read',
  },
  all: {
    icon: LayoutGrid,
    wash: 'bg-wash-violet',
    ink: 'text-wash-violet-ink',
    description: 'Every public campaign',
  },
};

/** A single campaign's state, in the listing's words. */
export const CAMPAIGN_STATE_NAMES = {
  active: 'Active',
  closed: 'Closed',
  completed: 'Completed',
} as const;

export type CampaignState = keyof typeof CAMPAIGN_STATE_NAMES;

/**
 * Whether a campaign takes donations right now: `active`, and not past its
 * end date.
 *
 * `donation` is the shared rule's answer (`donationAvailability` in
 * @sailent/validation) — sent by the API on a detail page, worked out from the
 * same rule for a listing row. One question, asked the same way by every card,
 * the donation panel and the Featured band.
 */
export function acceptsDonationsNow(campaign: {
  status: string;
  donation?: { state: string } | undefined;
}): boolean {
  return campaign.status === 'active' && (campaign.donation?.state ?? 'open') === 'open';
}

/**
 * Which of the three listing states a campaign is in.
 *
 * "Closed" is the lifecycle's `paused` — public, with donations closed for
 * now — as it is in the menu, and also an ACTIVE campaign whose end date has
 * passed (`donationState === 'ended'`): it takes no donations, so a badge
 * saying "Active" over it would be wrong. Anything else (a status the public
 * listing never returns) has no badge rather than a guessed one.
 */
export function campaignState(status: string, donationState?: string): CampaignState | null {
  if (status === 'active') return donationState === 'ended' ? 'closed' : 'active';
  if (status === 'paused') return 'closed';
  if (status === 'completed') return 'completed';
  return null;
}
