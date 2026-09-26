import Link from 'next/link';
import { MapPin, Package } from 'lucide-react';
import { Badge, Button, Card, CampaignProgress, cn, daysRemaining } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Campaign } from '@/lib/mock/types';

/**
 * Campaign card.
 *
 * Wraps the design-system card with real campaign data and the project's
 * media strategy. The rules from Phase 0 §5.2 are enforced here rather than
 * left to each caller:
 *   • progress shows a percentage AND both absolute figures
 *   • "days left" appears only when there is a real end date
 *   • the supporter count is suppressed below five
 *   • the whole card links to the detail page; Donate goes straight to giving
 */
export function CampaignCard({ campaign, className }: { campaign: Campaign; className?: string }) {
  const daysLeft = daysRemaining(campaign.endsAt);
  const isCompleted = campaign.status === 'completed';
  const detailHref = `/campaigns/${campaign.slug}`;

  return (
    <Card interactive className={cn('group relative flex flex-col overflow-hidden', className)}>
      <div className="relative">
        <MediaFrame media={campaign.cover} aspect="video" rounded={false} />
        {campaign.hasProducts && !isCompleted ? (
          <Badge
            variant="accent"
            className="bg-surface/95 absolute left-3 top-3 backdrop-blur-[1px]"
          >
            <Package aria-hidden="true" />
            Choose what to fund
          </Badge>
        ) : null}
        {isCompleted ? (
          <Badge
            variant="success"
            className="bg-surface/95 absolute left-3 top-3 backdrop-blur-[1px]"
          >
            Goal reached
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground flex flex-wrap items-center gap-x-2 uppercase">
          <span>{campaign.programName}</span>
          {campaign.location ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                <MapPin className="size-3" aria-hidden="true" />
                {campaign.location}
              </span>
            </>
          ) : null}
        </p>

        <h3 className="text-h4 font-semibold leading-snug">
          <Link
            href={detailHref}
            className="hover:text-primary focus-visible:outline-ring line-clamp-2 rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {campaign.title}
          </Link>
        </h3>

        <p className="text-body-sm text-muted-foreground line-clamp-2">
          {campaign.shortDescription}
        </p>

        <div className="mt-auto space-y-4 pt-2">
          <CampaignProgress
            raised={campaign.amountRaised}
            goal={campaign.goalAmount}
            donorCount={campaign.donorCount}
            daysLeft={daysLeft}
            size="sm"
          />

          {/* z-10 lifts the actions above the card-wide overlay link. */}
          <div className="relative z-10 flex items-center gap-3">
            {isCompleted ? (
              <Button asChild variant="secondary" size="sm" fullWidth>
                <Link href={detailHref}>See what happened</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm">
                  <Link href={`${detailHref}#give`}>Donate</Link>
                </Button>
                <Button asChild variant="link" size="sm">
                  <Link href={detailHref}>View campaign</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
