import * as React from 'react';
import { MapPin, Package } from 'lucide-react';

import { cn } from '../lib/cn';
import { daysRemaining } from '../lib/format';
import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Card } from '../primitives/card';
import { CampaignProgress } from './progress-bar';
import type { CampaignCardModel } from './types';

export interface CampaignCardProps {
  campaign: CampaignCardModel;
  /** Injected so the package stays framework-agnostic — the web app passes next/link. */
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;
  /** Injected so the web app can pass next/image. */
  ImageComponent?: React.ComponentType<{
    src: string;
    alt: string;
    className?: string;
    fill?: boolean;
    sizes?: string;
  }>;
  className?: string;
}

const DefaultLink: NonNullable<CampaignCardProps['LinkComponent']> = ({
  href,
  className,
  children,
}) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/**
 * CampaignCard. Anatomy per docs/information-architecture.md §5.2.
 *
 * The whole card is clickable to the detail page; the Donate button stops
 * propagation and goes straight to the donation builder, so the two most
 * likely intents each get a direct path.
 */
export function CampaignCard({
  campaign,
  LinkComponent = DefaultLink,
  ImageComponent,
  className,
}: CampaignCardProps) {
  const Link = LinkComponent;
  const daysLeft = daysRemaining(campaign.endsAt);
  const isCompleted = campaign.status === 'completed';
  const detailHref = `/campaigns/${campaign.slug}`;

  return (
    <Card interactive className={cn('group flex flex-col overflow-hidden', className)}>
      {/* Explicit aspect ratio so the layout never shifts when the image loads. */}
      <div className="bg-muted relative aspect-video overflow-hidden">
        {campaign.coverImage ? (
          ImageComponent ? (
            <ImageComponent
              src={campaign.coverImage.url}
              alt={campaign.coverImage.alt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className="duration-(--duration-slow) object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.coverImage.url}
              alt={campaign.coverImage.alt}
              className="size-full object-cover"
              loading="lazy"
            />
          )
        ) : null}

        {campaign.hasProducts ? (
          <Badge variant="accent" className="bg-surface/95 absolute left-3 top-3 backdrop-blur-sm">
            <Package aria-hidden="true" />
            Choose what to fund
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

          {/* `relative z-10` lifts the action above the card-wide overlay link. */}
          <div className="relative z-10 flex items-center gap-3">
            {isCompleted ? (
              <Button asChild variant="secondary" size="sm" fullWidth>
                <Link href={detailHref}>See what happened</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm">
                  <Link href={`${detailHref}/donate`}>Donate</Link>
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
