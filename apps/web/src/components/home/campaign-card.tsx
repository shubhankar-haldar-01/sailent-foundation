import Link from 'next/link';
import { ArrowRight, CalendarClock, Target, Users } from 'lucide-react';

import { Button, Progress, cn, formatCurrency, formatNumber } from '@sailent/ui';

import { CategoryIcon, beneficiaryNoun, categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { Campaign } from '@/lib/mock/types';

/**
 * A featured campaign card.
 *
 * The figures are all server-computed: `campaign.progress` comes from the
 * API's single implementation of progress, so this card cannot disagree with
 * the campaign page or the admin table. Where the API has not supplied it —
 * the development fixtures — it falls back to deriving locally.
 *
 * The whole card is a link via a stretched pseudo-element on the title, so the
 * hit area is the card while the accessible name stays the campaign title. The
 * Donate button sits ABOVE that overlay and keeps its own destination.
 *
 * The cover is 16:9 and FULL-BLEED to the card's top edge, which is what the
 * approved four-up design shows. It was a short 15:4 strip inset by 6px when
 * the row held three wide cards; at a quarter of the row that crop left a
 * letterbox too shallow to read a photograph in.
 */
export function HomeCampaignCard({
  campaign,
  className,
}: {
  campaign: Campaign;
  className?: string;
}) {
  const progress =
    campaign.progress ??
    (() => {
      const goal = Math.max(0, campaign.goalAmount);
      const raised = Math.max(0, campaign.amountRaised);
      const raw = goal > 0 ? Math.round((raised / goal) * 100) : 0;
      return { goal, raised, percent: Math.min(100, raw), rawPercent: raw };
    })();

  const daysLeft = campaign.daysLeft ?? null;
  const tone = categoryTone(campaign.category);

  return (
    <article
      className={cn(
        'border-border bg-surface group relative flex flex-col overflow-hidden rounded-xl border shadow-md',
        'hover-lift hover:shadow-lg',
        className,
      )}
    >
      {/*
        FULL-BLEED to the card's top edge — no inset. Only the top corners are
        rounded, so the photograph meets the card's own radius above and sits
        flush against the body below it.

        `overflow-hidden` on the inner frame is what keeps the hover zoom from
        escaping those rounded corners; the card's own `overflow-hidden` cannot
        do it alone, because the zoom would still square off the top two.
      */}
      <div className="relative">
        <div className="overflow-hidden rounded-t-xl">
          <MediaFrame
            media={campaign.cover}
            aspect="video"
            rounded={false}
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 46vw, 300px"
            className="hover-zoom group-hover:scale-[1.04] motion-reduce:scale-100"
          />
        </div>
        {campaign.category ? (
          /*
            The chip is drawn in its category's OWN colour, as the approved
            cards are — Education blue, Disaster Relief violet, Women
            Empowerment pink. The icon and the name carry the same meaning, so
            the hue is a third signal rather than the only one.
          */
          <p
            className={cn(
              'bg-surface text-caption absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold shadow-sm',
              tone.ink,
            )}
          >
            <CategoryIcon category={campaign.category} />
            {campaign.category}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3.5">
        {/*
          TWO LINES, ALWAYS.

          The title was free to wrap, so one long name pushed its card's
          progress bar a line lower than the three beside it — and the bar is
          the one thing a reader compares ACROSS cards, so it is the one thing
          that has to sit on a shared baseline. Reserving two lines costs an
          empty line under a short title and keeps the row honest.
        */}
        <h3 className="text-body min-h-[2lh] font-bold leading-snug [&>a]:line-clamp-2">
          <Link
            href={`/campaigns/${campaign.slug}`}
            className="hover:text-info-action focus-visible:outline-ring rounded-sm after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {campaign.title}
          </Link>
        </h3>

        <p className="text-caption text-muted-foreground mt-1 line-clamp-2 leading-snug">
          {campaign.shortDescription}
        </p>

        <div className="mt-3">
          {/* The percentage sits at the END OF THE BAR, as approved — reading
              "45%" beside the thing it fills needs no second glance. */}
          <div className="flex items-center gap-3">
            <Progress
              value={progress.percent}
              size="sm"
              className="flex-1"
              /*
                A gradient running from blue into the category's colour, which
                is what the approved bars do — an Education bar reads as flat
                blue because both stops are blue, and a Women Empowerment bar
                runs blue into pink.
              */
              indicatorClassName={cn('bg-gradient-to-r', tone.bar)}
              label={`${progress.percent}% of the ${formatCurrency(progress.goal)} goal raised`}
            />
            <span data-numeric="" className="text-caption font-bold tabular-nums">
              {progress.percent}%
            </span>
          </div>
          <p data-numeric="" className="text-caption mt-1.5 tabular-nums">
            <span className="font-bold">{formatCurrency(progress.raised)}</span>
            <span className="text-muted-foreground">
              {' '}
              raised of {formatCurrency(progress.goal)}
            </span>
          </p>
        </div>

        {/*
          ONE LINE, and it is worth the fuss: this row sets the height of every
          card in the grid.

          The cards lost ~45px when the row went four-up, and a campaign whose
          three figures wrapped onto a second line was then the tallest card on
          the band — so every other card grew a 45px dead band above its Donate
          button to match it. Shrinking the icons to 12px and the gap to 8px
          buys back the ~14px that was overflowing.

          `flex-wrap` STAYS as the fallback. An exceptional campaign — a
          four-digit day count beside a six-digit beneficiary target — should
          wrap rather than clip: a second line is untidy, a hidden figure is a
          lie. It is the uncommon case now rather than the common one.

          SPREAD across the card, not packed to the left, so the three figures
          land on the same x-positions in every card of the row.
        */}
        <ul className="text-overline text-muted-foreground mt-2.5 flex flex-wrap justify-between gap-x-2 gap-y-1 tracking-normal">
          {/* Donor counts below five are suppressed: on a young campaign the
              number discourages rather than reassures, and it edges towards
              identifying individual givers in a small community. */}
          {campaign.donorCount >= 5 ? (
            <li className="flex items-center gap-1 whitespace-nowrap">
              <Users className="size-3" aria-hidden="true" />
              <span data-numeric="" className="tabular-nums">
                {formatNumber(campaign.donorCount)}
              </span>{' '}
              donors
            </li>
          ) : null}
          {daysLeft !== null ? (
            <li className="flex items-center gap-1 whitespace-nowrap">
              <CalendarClock className="size-3" aria-hidden="true" />
              <span data-numeric="" className="tabular-nums">
                {daysLeft}
              </span>{' '}
              days left
            </li>
          ) : null}
          {campaign.beneficiaryTarget ? (
            <li className="flex items-center gap-1 whitespace-nowrap">
              <Target className="size-3" aria-hidden="true" />
              <span data-numeric="" className="tabular-nums">
                {formatNumber(campaign.beneficiaryTarget)}
              </span>{' '}
              {beneficiaryNoun(campaign.category)}
            </li>
          ) : null}
        </ul>

        {/* `mt-auto` on the wrapper, not the button: it pins the action to the
            foot of the card so a row of three ends level however many lines
            each title takes, while `pt-4` guarantees the gap above it when the
            card is no taller than its own content. */}
        <div className="mt-auto pt-3.5">
          {/* Above the stretched overlay, so it keeps its own destination. */}
          {/*
            `rounded-lg`, not the design system's default pill. The approved
            Donate button is a soft-cornered rectangle, and it is the one
            control on the card, so it follows the reference rather than the
            house default.
          */}
          <Button asChild size="md" fullWidth className="relative z-10 rounded-lg font-bold">
            <Link href={`/campaigns/${campaign.slug}#give`}>
              Donate Now
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
