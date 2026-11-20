import Link from 'next/link';
import { Banner, Button, Card, cn } from '@sailent/ui';

import {
  CampaignProgressBlock,
  type CampaignProgressFigures,
} from '@/components/donations/campaign-donation-summary';

/**
 * What stands where the donation card would, on a campaign that is not taking
 * donations (owner, 2026-11-19, Phase 4 of the UI feedback system).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NO WAY TO PAY, AND THE REASON IN ITS PLACE.
 *
 * A finished or paused campaign used to keep its donation card with the
 * amount chips and a disabled Donate button: a control that looks like it
 * should work and does not. Now the card is replaced by a banner saying why
 * (ended, or paused for now), with a way on to the campaigns that are open,
 * and the campaign's progress so what was raised stays on record.
 *
 * Wording is factual only: no reason for a pause is given, because the
 * record does not hold one.
 * ══════════════════════════════════════════════════════════════════════════
 */
export type ClosedState = 'paused' | 'ended';

const COPY: Record<ClosedState, { title: string; body: string }> = {
  paused: {
    title: 'Donations are paused for now',
    body: 'This campaign isn’t accepting donations at the moment. Its story stays here.',
  },
  ended: {
    title: 'This campaign has ended',
    body: 'It is no longer accepting donations. Its story and results stay here.',
  },
};

export function CampaignClosedCard({
  state,
  progress,
  className,
}: {
  state: ClosedState;
  progress?: CampaignProgressFigures;
  className?: string;
}) {
  const copy = COPY[state];
  return (
    <Card className={cn('rounded-xl px-4 py-3 shadow-sm', className)}>
      <Banner
        tone={state === 'paused' ? 'warning' : 'info'}
        title={copy.title}
        action={
          <Button asChild size="sm" variant="secondary" className="touch-target relative">
            <Link href="/campaigns">See open campaigns</Link>
          </Button>
        }
      >
        {copy.body}
      </Banner>
      {progress ? <CampaignProgressBlock figures={progress} className="mt-3" /> : null}
    </Card>
  );
}
