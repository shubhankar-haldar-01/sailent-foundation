import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';

import { Button, Card, percentOf } from '@sailent/ui';

import {
  CampaignProgressBlock,
  ShareButton,
} from '@/components/donations/campaign-donation-summary';
import type { Campaign } from '@/lib/mock/types';
import { acceptsDonationsNow } from '@/components/campaigns/campaign-status';

/**
 * The side card for a campaign that has no products to choose.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT SHOWS PROGRESS; IT DOES NOT TAKE MONEY.
 *
 * A campaign without products never had a donation builder on its page, and
 * this redesign does not add one — a new way to pay is not a layout change.
 * So this card carries what the builder's card would show above the basket —
 * raised, donors, the goal — and then either the way to the general donate
 * page, while the campaign is open, or the reason it is not.
 *
 * `id="give"` so the "Donate" links elsewhere on the site, which all point at
 * `/campaigns/…#give`, land here rather than at the top of the page.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignStatusCard({
  campaign,
  assurances,
}: {
  campaign: Campaign;
  /** The 80G / secure / trusted list, at the foot of the card. */
  assurances?: React.ReactNode;
}) {
  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const isOpen = acceptsDonationsNow(campaign);

  const reason =
    campaign.donation?.reason ??
    (campaign.status === 'paused'
      ? 'Donations are paused for this campaign while the program team reviews delivery.'
      : 'This campaign has finished and is no longer accepting donations.');

  return (
    <Card id="give" className="scroll-mt-24 rounded-xl p-5 shadow-sm">
      <h2 className="text-body-lg font-bold leading-tight">Support This Campaign</h2>

      <CampaignProgressBlock
        className="mt-4"
        figures={{
          goal,
          raised,
          percent: campaign.progress?.rawPercent ?? percentOf(raised, goal),
          donorCount: campaign.donorCount,
        }}
      />

      {isOpen ? (
        <Button asChild size="lg" fullWidth className="mt-5 rounded-lg">
          <Link href="/donate">
            Donate
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <p className="bg-surface-sunken text-body-sm mt-5 flex gap-2 rounded-lg p-3">
          <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {reason}
        </p>
      )}

      <div className="mt-4 flex justify-center">
        <ShareButton />
      </div>

      {assurances ? <div className="mt-3">{assurances}</div> : null}
    </Card>
  );
}
