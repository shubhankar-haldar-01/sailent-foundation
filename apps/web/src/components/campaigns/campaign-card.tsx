import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, Skeleton, cn, formatCurrency, formatNumber, percentOf } from '@sailent/ui';

import { SaveCampaignHeart } from '@/components/dashboard/save-campaign-button';
import { categoryTone } from '@/components/home/category-icon';
import { CoinsSolid, PeopleSolid, TargetSolid } from '@/components/home/focus-icons';
import { CAMPAIGN_STATE_NAMES, STATUS_VISUALS, campaignState } from './campaign-status';
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
  const isOpen = campaign.status === 'active' && (campaign.donation?.state ?? 'open') === 'open';
  const state = campaignState(campaign.status);
  const stateBadge = state && (showStatus || state !== 'active') ? STATUS_VISUALS[state] : null;

  return (
    <article
      className={cn(
        'border-border bg-surface group relative flex flex-col rounded-2xl border shadow-sm',
        /*
          Lifts on hover AND when anything inside it has keyboard focus, so a
          keyboard user sees which card they are in as clearly as a pointer
          user does. Movement only when the reader has not asked for less;
          the deeper shadow and firmer border carry the state either way.
        */
        'duration-(--duration-slow) ease-(--ease-out-soft) transition-[translate,box-shadow,border-color]',
        'hover:border-border-strong focus-within:border-border-strong focus-within:shadow-lg hover:shadow-lg',
        'motion-safe:focus-within:-translate-y-1.5 motion-safe:hover:-translate-y-1.5',
        className,
      )}
    >
      <div className="relative">
        {/*
          `overflow-hidden` on this wrapper, not the card, so the hover zoom
          stays inside the rounded top corners without also clipping the focus
          ring of everything else on the card.
        */}
        {/* A soft shade rises from the foot of the photograph on hover, for depth. */}
        <div className="duration-(--duration-slow) relative overflow-hidden rounded-t-2xl after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-t after:from-black/25 after:to-transparent after:opacity-0 after:transition-opacity group-hover:after:opacity-100">
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
            The same mark and colour as the matching choice in the "Show"
            menu, on a solid white pill so it reads over any photograph. The
            word is always there — the colour is never the only signal.
          */
          <p
            className={cn(
              'bg-surface text-caption absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 font-bold leading-none shadow-sm',
              stateBadge.ink,
            )}
          >
            <span
              aria-hidden="true"
              className={cn('grid size-5 place-items-center rounded-full', stateBadge.wash)}
            >
              <stateBadge.icon className="size-3" />
            </span>
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
            On a white backing so the wash is a known colour whatever the
            photograph does underneath — the ink is measured against wash over
            white, and clears 4.5:1 there.
          */
          <span className="bg-surface absolute bottom-2.5 left-3 rounded-full shadow-sm">
            <span
              className={cn(
                'text-caption block rounded-full px-2.5 py-0.5 font-bold leading-snug',
                tone.chip,
              )}
            >
              {campaign.category}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/*
          DM Sans Bold, 14px on a 21px line — the approved card title, matched
          against the reference by line width and letterforms. The site's body
          face, set explicitly: headings default to the display face.

          `text-wrap`, not the base layer's `balance`: balancing evens the two
          lines out, so a title broke halfway across the card and left the
          right of it empty. Ordinary wrapping fills each line, and anything
          past two lines ends in an ellipsis rather than pushing the figures
          down.
        */}
        <h3 className="text-body-sm text-wrap font-sans font-bold leading-normal [&>a]:line-clamp-2">
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
        <div className="mt-auto pt-4">
          <dl className="flex items-start justify-between gap-2">
            {campaign.donorCount >= 5 ? (
              <Figure
                label="Donors"
                value={formatNumber(campaign.donorCount)}
                icon={PeopleSolid}
                iconClassName="text-wash-rose-ink size-5"
              />
            ) : null}
            <Figure
              label="Raised"
              value={formatCurrency(raised)}
              valueClassName="text-success"
              icon={CoinsSolid}
              iconClassName="text-success size-5"
              align={campaign.donorCount >= 5 ? 'center' : 'start'}
            />
            <Figure
              label="Goal"
              value={formatCurrency(goal)}
              icon={TargetSolid}
              iconClassName="text-wash-rose-ink size-[1.125rem]"
              align="end"
            />
          </dl>

          {goal > 0 ? (
            <>
              {/*
                Drawn in the category's own colour — the same ink as the label
                on the photograph — so a row of cards reads cause by cause. The
                percentage beside it carries the meaning; the hue is a cue.
              */}
              <div
                role="img"
                aria-label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
                className="bg-muted mt-3 h-2 overflow-hidden rounded-full"
              >
                <span
                  aria-hidden="true"
                  // Grows from empty to its value as the card lands.
                  className={cn('fill-in block h-full rounded-full', tone.fill)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-caption text-muted-foreground mt-1.5 flex items-baseline justify-between gap-3">
                <span data-numeric="">
                  <span className={cn('font-bold', tone.ink)}>{percent}%</span> Complete
                </span>
                <span data-numeric="">
                  {percent >= 100 ? 'Goal reached' : `${100 - percent}% to go`}
                </span>
              </p>
            </>
          ) : null}

          {/* z-10 lifts the action above the card-wide overlay link. */}
          <div className="relative z-10 mt-4">
            {isOpen ? (
              <Button asChild fullWidth className={cn('h-10 font-bold', CTA_MOTION)}>
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
                className={cn('h-10 font-bold', CTA_MOTION)}
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
 * Icon and value over label, visually; label first in the DOM, so a screen
 * reader says "Raised, ₹4,67,400" rather than a bare amount followed by what
 * it was. The icon is decorative — the label already names the figure.
 *
 * Label placement follows the approved card: at the start it sits under the
 * icon's centre, in the middle it is centred under icon and value together,
 * and at the end it lines up with the value's last digit.
 */
function Figure({
  label,
  value,
  valueClassName,
  icon: Icon,
  iconClassName,
  align = 'start',
}: {
  label: string;
  value: string;
  valueClassName?: string;
  icon: typeof PeopleSolid;
  iconClassName?: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col-reverse',
        align === 'center' && 'text-center',
        align === 'end' && 'text-right',
      )}
    >
      <dt
        className={cn(
          'text-caption text-muted-foreground leading-tight',
          align === 'start' && 'pl-2.5',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'flex items-center gap-1.5',
          align === 'center' && 'justify-center',
          align === 'end' && 'justify-end',
        )}
      >
        {/* Each mark pops a little when the card is hovered. */}
        <Icon
          aria-hidden="true"
          className={cn('hover-pop motion-safe:group-hover:scale-115 shrink-0', iconClassName)}
        />
        <span
          data-numeric=""
          className={cn(
            'text-body-sm whitespace-nowrap font-bold tabular-nums leading-snug',
            valueClassName,
          )}
        >
          {value}
        </span>
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
    <div className="border-border bg-surface flex w-full flex-col rounded-2xl border shadow-sm">
      <div className="relative">
        <Skeleton className="aspect-[2/1] w-full rounded-none rounded-t-2xl" />
        <Skeleton className="bg-surface absolute bottom-2.5 left-3 h-5 w-20 rounded-full" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Skeleton className="h-5 w-4/5" />
        <div className="mt-6 flex justify-between gap-2">
          <Skeleton className="h-9 w-12" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-16" />
        </div>
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
        <div className="mt-2 flex justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <Skeleton className="mt-4 h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
