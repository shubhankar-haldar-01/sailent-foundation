import * as React from 'react';
import { ArrowRight, Coins, MapPin, Package, Target, Users } from 'lucide-react';

import { cn } from '../lib/cn';
import { formatCurrency, formatNumber, percentOf } from '../lib/format';
import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Skeleton } from '../primitives/skeleton';
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
  showStatus?: boolean;
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

const CTA_MOTION = cn(
  'group/cta duration-(--duration-base) ease-(--ease-out-soft) transition-[translate,scale,box-shadow,background-color]',
  'hover:shadow-md active:scale-[0.98] motion-safe:hover:-translate-y-px',
);
const CTA_ARROW =
  'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate] motion-safe:group-hover/cta:translate-x-1';

/**
 * CampaignCard — shared NGO domain component aligned with the approved design contract:
 *  - 22px rounded container with interactive hover elevation
 *  - 4-corner rounded photograph with hover-zoom and depth gradient
 *  - Category chip and optional product badge
 *  - Three-column peach/mint statistics discs (Donors, Raised, Goal) with dividers
 *  - Brand-orange progress bar with dual percentage captions
 *  - Accessible pill-shaped CTA with navy label on brand orange (#EB6A1F)
 */
export function CampaignCard({
  campaign,
  LinkComponent = DefaultLink,
  ImageComponent,
  showStatus = false,
  className,
}: CampaignCardProps) {
  const Link = LinkComponent;
  const isCompleted = campaign.status === 'completed';
  const detailHref = `/campaigns/${campaign.slug}`;

  const goal = campaign.goalAmount;
  const raised = campaign.amountRaised;
  const percent = percentOf(raised, goal);
  const barWidth = Math.min(100, Math.max(percent, raised > 0 ? 2 : 0));

  return (
    <article
      className={cn(
        'card-interactive @container group relative flex flex-col',
        'rounded-[22px] p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="relative">
        {/*
          The photograph is rounded at all four corners with a subtle hover zoom
          and soft gradient overlay for depth.
        */}
        <div className="duration-(--duration-slow) bg-muted relative aspect-[2.25/1] overflow-hidden rounded-2xl after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/25 after:to-transparent after:opacity-0 after:transition-opacity group-hover:after:opacity-100">
          {campaign.coverImage ? (
            ImageComponent ? (
              <ImageComponent
                src={campaign.coverImage.url}
                alt={campaign.coverImage.alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="hover-zoom size-full object-cover transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:scale-100"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={campaign.coverImage.url}
                alt={campaign.coverImage.alt}
                className="hover-zoom size-full object-cover transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:scale-100"
                loading="lazy"
              />
            )
          ) : (
            <div className="bg-muted text-muted-foreground flex size-full items-center justify-center">
              <Package className="size-8 opacity-40" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Status pill if requested and relevant */}
        {showStatus && campaign.status !== 'active' ? (
          <p
            className={cn(
              'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold leading-none shadow-sm',
              campaign.status === 'completed'
                ? 'bg-wash-blue text-wash-blue-ink'
                : 'bg-wash-amber text-wash-amber-ink',
            )}
          >
            <span className="sr-only">Status: </span>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </p>
        ) : null}

        {/* Category chip or product badge */}
        {campaign.category ? (
          <span className="bg-surface absolute bottom-2.5 left-3 rounded-full shadow-sm">
            <span className="bg-wash-blue/60 text-wash-blue-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-bold leading-none sm:px-3 sm:py-1.5 sm:text-[0.8125rem]">
              {campaign.category}
            </span>
          </span>
        ) : campaign.hasProducts ? (
          <Badge variant="accent" className="bg-surface/95 absolute left-3 top-3 backdrop-blur-sm">
            <Package className="size-3.5" aria-hidden="true" />
            Choose what to fund
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        {/* Programme name and optional location */}
        <p className="text-overline tracking-(--text-overline--letter-spacing) text-muted-foreground mb-1 flex flex-wrap items-center gap-x-2 uppercase">
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

        {/* Title */}
        <h3 className="font-display text-wrap text-[1.0625rem] font-bold leading-snug tracking-[-0.01em] sm:text-[1.125rem] [&>a]:line-clamp-2">
          <Link
            href={detailHref}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {campaign.title}
          </Link>
        </h3>

        {/* Short description */}
        {campaign.shortDescription ? (
          <p className="text-body-sm text-muted-foreground mt-1 line-clamp-2">
            {campaign.shortDescription}
          </p>
        ) : null}

        <div className="mt-auto pt-2">
          {/*
            Three-column peach/mint statistics discs (Donors, Raised, Goal) with dividers
          */}
          <dl
            className={cn(
              '-mx-2 grid items-stretch gap-x-1.5',
              campaign.donorCount >= 5
                ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]'
                : 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
            )}
          >
            {campaign.donorCount >= 5 ? (
              <>
                <Figure
                  label="Donors"
                  value={formatNumber(campaign.donorCount)}
                  icon={Users}
                  iconClassName="text-wash-coral-ink"
                  discClassName="bg-wash-coral"
                />
                <FigureDivider />
              </>
            ) : null}
            <Figure
              label="Raised"
              value={formatCurrency(raised)}
              valueClassName="text-success"
              icon={Coins}
              iconClassName="text-success"
              discClassName="bg-wash-mint"
            />
            <FigureDivider />
            <Figure
              label="Goal"
              value={formatCurrency(goal)}
              icon={Target}
              iconClassName="text-wash-coral-ink"
              discClassName="bg-wash-coral"
            />
          </dl>

          {/* Brand orange progress bar with dual captions */}
          {goal > 0 ? (
            <>
              <div
                role="img"
                aria-label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
                className="bg-muted mt-2.5 h-2 overflow-hidden rounded-full"
              >
                <span
                  aria-hidden="true"
                  className="fill-in bg-primary block h-full rounded-full"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span data-numeric="">
                  <span className="text-primary font-bold">{percent}%</span> Complete
                </span>
                <span data-numeric="">
                  {percent >= 100 ? 'Goal reached' : `${100 - percent}% to go`}
                </span>
              </p>
            </>
          ) : null}

          {/* Action CTA */}
          <div className="relative z-10 mt-2.5">
            {isCompleted ? (
              <Button
                asChild
                variant="secondary"
                fullWidth
                className={cn('h-9 text-[0.875rem] font-bold', CTA_MOTION)}
              >
                <Link href={detailHref}>
                  See What Happened
                  <ArrowRight aria-hidden="true" className={CTA_ARROW} />
                </Link>
              </Button>
            ) : (
              <Button asChild fullWidth className={cn('h-9 text-[0.875rem] font-bold', CTA_MOTION)}>
                <Link href={`${detailHref}#give`}>
                  Donate Now
                  <ArrowRight aria-hidden="true" className={CTA_ARROW} />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * One statistic figure: a tinted disc with the icon, value, and label.
 */
function Figure({
  label,
  value,
  valueClassName,
  icon: Icon,
  iconClassName,
  discClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  iconClassName?: string;
  discClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <dt className="text-muted-foreground order-last text-[0.6875rem] leading-tight">{label}</dt>
      <dd className="flex flex-col items-center">
        <span
          aria-hidden="true"
          className={cn(
            'hover-pop motion-safe:group-hover:scale-115 grid size-[1.375rem] place-items-center rounded-full',
            discClassName,
          )}
        >
          <Icon aria-hidden="true" className={cn('size-3', iconClassName)} />
        </span>
        <span
          data-numeric=""
          className={cn(
            'text-foreground @[20rem]:text-[0.8125rem] mt-1 whitespace-nowrap text-[0.75rem] font-bold tabular-nums leading-snug',
            valueClassName,
          )}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

function FigureDivider() {
  return <div role="none" aria-hidden="true" className="bg-border/80 my-1 w-px shrink-0" />;
}

/**
 * Loading skeleton matching the approved card anatomy.
 */
export function CampaignCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'border-border/50 bg-surface flex w-full flex-col rounded-[22px] border p-3.5 shadow-sm sm:p-4',
        className,
      )}
    >
      <div className="relative">
        <Skeleton className="aspect-[2.25/1] w-full rounded-2xl" />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="mt-2 h-4 w-1/2 rounded" />
        <div className="mt-auto pt-4">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-10 rounded" />
            <Skeleton className="h-10 rounded" />
            <Skeleton className="h-10 rounded" />
          </div>
          <Skeleton className="mt-3 h-2 w-full rounded-full" />
          <Skeleton className="mt-3 h-9 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
