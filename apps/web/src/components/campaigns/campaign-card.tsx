'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, Skeleton, cn, formatCurrency, formatNumber, percentOf } from '@sailent/ui';

import { SaveCampaignHeart } from '@/components/dashboard/save-campaign-button';
import { CategoryIcon } from '@/components/home/category-icon';
import {
  CAMPAIGN_STATE_NAMES,
  STATUS_VISUALS,
  acceptsDonationsNow,
  campaignState,
} from './campaign-status';
import { MediaFrame } from '@/components/media/media-frame';
import type { Campaign } from '@/lib/mock/types';

/**
 * The card's one action: it lifts and deepens under the pointer, presses in
 * when tapped, and its arrow leans the way it is going. The lift and lean are
 * movement, so they stand down under reduced motion; the colour change stays.
 */
const CTA_MOTION = cn(
  'group/cta duration-(--duration-base) ease-(--ease-out-soft) transition-[translate,scale,box-shadow,background-color]',
  'active:scale-[0.98]',
);
const CTA_ARROW =
  'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate] motion-safe:group-hover/cta:translate-x-1';

/**
 * Campaign card — the listing's card, on /campaigns, the homepage and programme pages.
 *
 * SIMPLIFIED (owner, 2026-11-21; `AGENTS.md` §11 item 2): the whole card is the
 * link; one programme tag; the figures as a plain row (Raised, Goal, Donors);
 * the progress bar in the brand; and one quiet "Donate Now" (a brand outline,
 * not the orange — orange is for the page's own Donate). No coloured discs.
 * A small status pill: always when the campaign is not active, and on every
 * card where the listing asks for it (`showStatus`).
 */
export function CampaignCard({
  campaign,
  save,
  showStatus = false,
  className,
}: {
  campaign: Campaign;
  save?: { signedIn: boolean; saved: boolean; returnTo?: string };
  showStatus?: boolean;
  variant?: 'standard' | 'featured';
  className?: string;
}) {
  const detailHref = `/campaigns/${campaign.slug}`;

  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  const percent = campaign.progress?.rawPercent ?? percentOf(raised, goal);
  const barWidth = Math.min(100, Math.max(percent, raised > 0 ? 2 : 0));
  const isOpen = acceptsDonationsNow(campaign);
  const state = campaignState(campaign.status, campaign.donation?.state);
  // A campaign that is not active always says so; on /campaigns (`showStatus`)
  // every card states its state, Active included (e2e "every card says which
  // state it is in, in every view").
  const stateBadge = state && (showStatus || state !== 'active') ? STATUS_VISUALS[state] : null;

  return (
    <article
      className={cn(
        'card-interactive @container group relative flex flex-col',
        'rounded-2xl p-3 sm:p-3.5',
        className,
      )}
    >
      <div className="relative">
        {/*
          The photograph is rounded at all four corners (owner's card design,
          2026-10-08). `overflow-hidden` here, not on the card, so the hover
          zoom stays inside the corners without clipping any focus ring.
          A soft shade rises from its foot on hover, for depth.
        */}
        <div className="relative overflow-hidden rounded-xl">
          <MediaFrame
            media={campaign.cover}
            aspect="video"
            rounded={false}
            className="hover-zoom aspect-[16/10] group-hover:scale-[1.03] motion-reduce:scale-100"
            sizes="(max-width: 767px) 92vw, (max-width: 1023px) 46vw, (max-width: 1279px) 31vw, 320px"
          />
        </div>

        {state && stateBadge ? (
          /*
            A neutral pill like the programme tag, opaque so it reads over any
            photograph; the state's own colour is in its icon (the same mark
            as the matching choice in the "Show" menu). The word is always
            there: the colour is never the only signal. Neutral because the
            state's wash and ink measured 4.41:1 for 12px text (2026-11-21).
          */
          <p className="bg-surface/95 text-foreground shadow-xs absolute left-2.5 top-2.5 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium">
            <stateBadge.icon className={cn('size-3', stateBadge.ink)} aria-hidden="true" />
            <span className="sr-only">Status: </span>
            {CAMPAIGN_STATE_NAMES[state]}
          </p>
        ) : null}

        {save ? (
          // Above the card-wide link overlay, so it keeps its own action.
          <SaveCampaignHeart
            campaignId={campaign.id}
            title={campaign.title}
            signedIn={save.signedIn}
            saved={save.saved}
            returnTo={save.returnTo}
            className="absolute right-2.5 top-2.5 z-10"
          />
        ) : null}

        {campaign.category ? (
          // The one programme tag: neutral, on an opaque surface so it reads
          // over any photograph.
          <span className="bg-surface/95 text-foreground shadow-xs absolute bottom-2.5 left-2.5 inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium">
            <CategoryIcon category={campaign.category} className="text-muted-foreground size-3" />
            {campaign.category}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        {/*
          The display face, large, as the owner's card design sets it. Ordinary
          wrapping rather than the base layer's `balance` (which evens two lines
          out and leaves the right of the card empty), and anything past two
          lines ends in an ellipsis rather than pushing the figures down.
        */}
        <h3 className="font-display text-wrap text-[1.0625rem] font-semibold leading-snug [&>a]:line-clamp-2">
          {/* The card-wide link: its overlay makes the whole card clickable. */}
          <Link
            href={detailHref}
            className="group-hover:text-primary rounded-sm transition-colors after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {campaign.title}
          </Link>
        </h3>

        {/*
          `mt-auto` pins the figures, the bar and the button to the foot of the
          card. Cards in a row stretch to the tallest, so every progress bar in
          the row lands on the same line however long each title runs — the bar
          is what a reader compares ACROSS cards.
        */}
        <div className="mt-auto pt-2">
          {/* The figures as a plain row: label over value, no discs. */}
          <dl className="grid grid-cols-3 gap-2">
            <Figure label="Raised" value={formatCurrency(raised)} />
            <Figure label="Goal" value={formatCurrency(goal)} />
            <Figure label="Donors" value={formatNumber(campaign.donorCount ?? 0)} />
          </dl>

          {goal > 0 ? (
            <>
              {/* The brand, not orange (§11 item 12). The percentage beside it
                  carries the meaning; the bar is the cue. */}
              <div
                role="img"
                aria-label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
                className="bg-muted mt-2.5 h-2 overflow-hidden rounded-full"
              >
                <span
                  aria-hidden="true"
                  // Grows from empty to its value as the card lands.
                  className="fill-in bg-primary block h-full rounded-full"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span data-numeric="">
                  <span className="text-foreground font-semibold">{percent}%</span> Complete
                </span>
                <span data-numeric="">
                  {percent >= 100 ? 'Goal reached' : `${100 - percent}% to go`}
                </span>
              </p>
            </>
          ) : null}

          {/* z-10 lifts the action above the card-wide overlay link. */}
          <div className="relative z-10 mt-2.5">
            {isOpen ? (
              <Button
                asChild
                fullWidth
                size="sm"
                variant="secondary"
                className={cn('h-10', CTA_MOTION)}
              >
                <Link href={`${detailHref}#give`}>
                  Donate Now
                  <ArrowRight aria-hidden="true" className={CTA_ARROW} />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                fullWidth
                className={cn('h-10', CTA_MOTION)}
              >
                <Link href={detailHref}>
                  {campaign.status === 'completed' ? 'See What Happened' : 'View Campaign'}
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
 * One figure: the label over its value. The label comes first, so a screen
 * reader says "Raised, ₹4,67,400" rather than a bare amount.
 */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs leading-tight">{label}</dt>
      <dd
        data-numeric=""
        className="text-foreground mt-0.5 truncate text-sm font-semibold tabular-nums leading-snug"
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The card's loading shape, block for block.
 *
 * Same frame ratio, same padding, same line heights and the same button, so a
 * grid of these is replaced by a grid of cards without anything moving.
 */
export function CampaignCardSkeleton() {
  return (
    <div className="border-border bg-surface flex w-full flex-col rounded-2xl border p-3 sm:p-3.5">
      <div className="relative">
        <Skeleton className="aspect-[16/10] w-full rounded-xl" />
        <Skeleton className="bg-surface absolute bottom-2.5 left-2.5 h-6 w-24 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-2.5">
        <Skeleton className="h-5 w-4/5" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-3.5 h-2 w-full rounded-full" />
        <div className="mt-1 flex justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="mt-2.5 h-10 rounded-lg" />
      </div>
    </div>
  );
}
