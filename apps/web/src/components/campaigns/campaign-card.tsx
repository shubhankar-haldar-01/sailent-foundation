import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, Skeleton, cn, formatCurrency, formatNumber, percentOf } from '@sailent/ui';

import { SaveCampaignHeart } from '@/components/dashboard/save-campaign-button';
import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { CoinsSolid, PeopleSolid, TargetSolid } from '@/components/home/focus-icons';
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
  'hover:shadow-md active:scale-[0.98] motion-safe:hover:-translate-y-px',
);
const CTA_ARROW =
  'duration-(--duration-base) ease-(--ease-out-soft) transition-[translate] motion-safe:group-hover/cta:translate-x-1';

/**
 * Campaign card — the listing's card, and the "More in …" card on a campaign.
 *
 * Image, category, title, the three figures, progress, and one action, in
 * that order. No description: the card says what the campaign is and how far
 * it has got, and the campaign's own page says the rest. The rules from Phase 0 §5.2 are enforced here rather
 * than left to each caller:
 *   • progress shows a percentage AND both absolute figures
 *   • the donor count is suppressed below five
 *   • the whole card links to the detail page; the button goes straight to
 *     giving, and only on a campaign that is taking donations
 *
 * Every figure is the campaign's own — `progress` where the API computed it,
 * the raw columns where it did not — and nothing here rounds money.
 */
export function CampaignCard({
  campaign,
  className,
  save,
  showStatus = false,
}: {
  campaign: Campaign;
  className?: string;
  /**
   * Draw the save heart. Omitted where the card is a cross-link rather than a
   * place to browse — the related campaigns on a campaign page.
   */
  save?: { signedIn: boolean; saved: boolean; returnTo?: string };
  /**
   * Badge EVERY card with its state, Active included. The campaign listing
   * does this in every "Show" view, so a card's state is always on the card
   * whichever filter brought it there. Elsewhere — the related campaigns on a
   * campaign page — only Closed and Completed are badged, as the exceptions.
   */
  showStatus?: boolean;
}) {
  const detailHref = `/campaigns/${campaign.slug}`;
  const tone = categoryTone(campaign.category);

  const goal = campaign.progress?.goal ?? campaign.goalAmount;
  const raised = campaign.progress?.raised ?? campaign.amountRaised;
  // Unclamped, as on the campaign page: 112% is said as 112%, not as 100%.
  const percent = campaign.progress?.rawPercent ?? percentOf(raised, goal);
  // A sliver of bar for any real money, so ₹500 against ₹5 lakh is not drawn as nothing.
  const barWidth = Math.min(100, Math.max(percent, raised > 0 ? 2 : 0));
  const isOpen = acceptsDonationsNow(campaign);
  const state = campaignState(campaign.status, campaign.donation?.state);
  const stateBadge = state && (showStatus || state !== 'active') ? STATUS_VISUALS[state] : null;

  return (
    <article
      className={cn(
        // `@container`: the figures size themselves to the card, not the screen.
        'bg-surface @container group relative flex flex-col rounded-2xl shadow-[0_8px_28px_-14px_rgb(15_23_42/0.22)]',
        'border-border/50 dark:border-border border',
        /*
          Lifts on hover AND when anything inside it has keyboard focus, so a
          keyboard user sees which card they are in as clearly as a pointer
          user does. Movement only when the reader has not asked for less;
          the deeper shadow carries the state either way.
        */
        'duration-(--duration-slow) ease-(--ease-out-soft) transition-[translate,box-shadow,border-color]',
        'focus-within:shadow-lg hover:shadow-lg',
        'motion-safe:focus-within:-translate-y-1.5 motion-safe:hover:-translate-y-1.5',
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
        <div className="duration-(--duration-slow) relative overflow-hidden rounded-2xl after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/25 after:to-transparent after:opacity-0 after:transition-opacity group-hover:after:opacity-100">
          <MediaFrame
            media={campaign.cover}
            aspect="video"
            rounded={false}
            className="hover-zoom aspect-[2/1] group-hover:scale-[1.06] motion-reduce:scale-100"
            sizes="(max-width: 767px) 92vw, (max-width: 1023px) 46vw, (max-width: 1279px) 31vw, 320px"
          />
        </div>

        {state && stateBadge ? (
          /*
            A filled pill in the state's own wash and ink — the same mark and
            colour as the matching choice in the "Show" menu. The wash is
            opaque, so it reads over any photograph, and the word is always
            there: the colour is never the only signal.
          */
          <p
            className={cn(
              'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold leading-none shadow-sm',
              stateBadge.wash,
              stateBadge.ink,
            )}
          >
            <stateBadge.icon className="size-4" aria-hidden="true" />
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
            className="absolute right-3 top-3 z-10"
          />
        ) : null}

        {campaign.category ? (
          /*
            The category's icon and name in its own ink, on its wash over a
            white backing, so the colours are known whatever the photograph
            does underneath — the ink is measured against wash over white.
          */
          <span className="bg-surface absolute bottom-4 left-3 rounded-full shadow-sm">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-bold leading-none',
                // The 60% wash over white, not the full wash: at full strength
                // the blue and gold inks fall to 4.36:1 and 4.24:1.
                tone.chip,
              )}
            >
              <CategoryIcon category={campaign.category} className="size-4" />
              {campaign.category}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3.5">
        {/*
          The display face, large, as the owner's card design sets it. Ordinary
          wrapping rather than the base layer's `balance` (which evens two lines
          out and leaves the right of the card empty), and anything past two
          lines ends in an ellipsis rather than pushing the figures down.
        */}
        <h3 className="font-display text-wrap text-[1.125rem] font-bold leading-snug tracking-[-0.01em] [&>a]:line-clamp-2">
          <Link
            href={detailHref}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <div className="mt-auto pt-3.5">
          {/*
            Equal columns, each figure centred in its own, with the dividers
            between them (owner request, 2026-10-08: smaller, evenly aligned).
            Without a donor count the two remaining figures share the row.
          */}
          <dl
            className={cn(
              'grid items-stretch gap-x-1.5',
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
                  icon={PeopleSolid}
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
              icon={CoinsSolid}
              iconClassName="text-success"
              discClassName="bg-wash-mint"
            />
            <FigureDivider />
            <Figure
              label="Goal"
              value={formatCurrency(goal)}
              icon={TargetSolid}
              iconClassName="text-wash-coral-ink"
              discClassName="bg-wash-coral"
            />
          </dl>

          {goal > 0 ? (
            <>
              {/*
                The brand orange, as the owner's card design draws it. The
                percentage beside it carries the meaning; the bar is the cue.
              */}
              <div
                role="img"
                aria-label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
                className="bg-muted mt-3.5 h-2.5 overflow-hidden rounded-full"
              >
                <span
                  aria-hidden="true"
                  // Grows from empty to its value as the card lands.
                  className="fill-in bg-primary block h-full rounded-full"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-muted-foreground mt-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span data-numeric="">
                  <span className="text-primary font-bold">{percent}%</span> Complete
                </span>
                <span data-numeric="">
                  {percent >= 100 ? 'Goal reached' : `${100 - percent}% to go`}
                </span>
              </p>
            </>
          ) : null}

          {/* z-10 lifts the action above the card-wide overlay link. */}
          <div className="relative z-10 -mx-1 mt-3">
            {isOpen ? (
              <Button
                asChild
                fullWidth
                className={cn('h-10 text-[0.875rem] font-bold', CTA_MOTION)}
              >
                <Link href={`${detailHref}#give`}>
                  Donate Now
                  <ArrowRight aria-hidden="true" className={CTA_ARROW} />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="secondary"
                fullWidth
                className={cn('h-10 text-[0.875rem] font-bold', CTA_MOTION)}
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
 * One figure, stacked and centred: a tinted disc with the icon, the value,
 * then the label (owner's card design, 2026-10-08).
 *
 * The label comes FIRST in the DOM — `order` puts it last on screen — so a
 * screen reader says "Raised, ₹4,67,400" rather than a bare amount followed by
 * what it was. The icon is decorative: the label already names the figure.
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
  icon: typeof PeopleSolid;
  iconClassName?: string;
  discClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <dt className="text-muted-foreground order-last text-[0.6875rem] leading-tight">{label}</dt>
      <dd className="flex flex-col items-center">
        {/* Each mark pops a little when the card is hovered. */}
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

/** The rule between two figures — decoration, so hidden from assistive tech. */
function FigureDivider() {
  return <div role="none" aria-hidden="true" className="bg-border/80 my-1 w-px shrink-0" />;
}

/**
 * The card's loading shape, block for block.
 *
 * Same frame ratio, same padding, same line heights and the same button, so a
 * grid of these is replaced by a grid of cards without anything moving.
 */
export function CampaignCardSkeleton() {
  return (
    <div className="border-border/50 bg-surface flex w-full flex-col rounded-2xl border shadow-sm">
      <div className="relative">
        <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
        <Skeleton className="bg-surface absolute bottom-4 left-3 h-7 w-28 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-3.5 pt-3.5">
        <Skeleton className="h-6 w-4/5" />
        <div className="mt-6 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((key) => (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <Skeleton className="size-[1.375rem] rounded-full" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
        <div className="mt-2 flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="-mx-1 mt-3 h-10 rounded-full" />
      </div>
    </div>
  );
}
