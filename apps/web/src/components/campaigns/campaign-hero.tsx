import { CalendarDays, MapPin, Users } from 'lucide-react';

import { StatusBadge, formatDate, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import { PageShell } from '@/components/layout/page-shell';
import { ScriptAccent } from '@/components/sections/script-accent';
import type { Campaign } from '@/lib/mock/types';

/**
 * The campaign hero.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PHOTOGRAPH IS THE RIGHT HALF OF THE BAND, NOT A PANEL INSIDE IT.
 *
 * It runs to the edge of the viewport and bleeds under the text column, which
 * is what the approved design does and what stops the band reading as a card.
 * Achieved with a full-bleed absolute image and a `PageShell` laid over it, so
 * the text still sits on the page grid and lines up with everything below.
 *
 * The text column gets its own opaque backing at small sizes, where the two
 * halves stack and words would otherwise land on the photograph. Above `lg` the
 * backing becomes a gradient that fades into the image.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THREE FACTS, AND ONLY ONES THE RECORD HOLDS. Location, people in need and the
 * campaign period each render only when the campaign actually carries them —
 * an empty "0 people in need" is worse than a shorter row (decision A14).
 */
export function CampaignHero({ campaign }: { campaign: Campaign }) {
  const period = [
    campaign.startsAt ? formatDate(campaign.startsAt, 'short') : null,
    campaign.endsAt ? formatDate(campaign.endsAt, 'short') : null,
  ].filter(Boolean);

  return (
    <section aria-labelledby="campaign-title" className="border-border relative border-b">
      {/*
        The photograph. `aria-hidden` and empty alt: the campaign title says
        what this is, and a second description of the same subject is an
        interruption rather than an aid.
      */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] lg:block">
        {/*
          `aspect-auto h-full` OVERRIDES the frame's own ratio.

          `MediaFrame` sizes itself by aspect ratio, which is right everywhere
          else and wrong here — this one has to fill a column whose height is
          set by the text beside it. The image inside is already `fill` +
          `object-cover`, so removing the ratio is all that is needed.
        */}
        <MediaFrame
          media={{ ...campaign.cover, alt: '' }}
          aspect="hero"
          rounded={false}
          priority
          className="aspect-auto h-full w-full"
          sizes="52vw"
        />

        {/*
          A NARROW seam, not a wash over the whole picture.

          This ran the full width and bleached the left third of every
          photograph. It only has to soften the join with the text column, so it
          is now a third of the width and stops there.
        */}
        <div
          aria-hidden="true"
          className="from-surface absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r to-transparent"
        />

        {/*
          A scrim under the script, and it is not decoration.

          The words are white and the photograph behind them is whatever the
          campaign team uploaded — a bright sky puts white on near-white and the
          line disappears. A gradient from the right edge guarantees the
          contrast whatever the picture, which a text-shadow cannot.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-l from-black/55 via-black/15 to-transparent"
        />

        <ScriptAccent
          size="lg"
          heart
          className="absolute right-8 top-1/2 max-w-[13rem] -translate-y-1/2 text-right text-white xl:right-14"
        >
          Together for a Safer Tomorrow
        </ScriptAccent>
      </div>

      <PageShell className="relative py-8 md:py-10">
        <div className="lg:max-w-[46%]">
          <div className="flex flex-wrap items-center gap-2">
            {/*
              THE MINT PILL, not the category's own colour.

              The listing cards tint each category differently, and that stays —
              it is what lets somebody scan a row of cards. The hero badge is a
              different job: there is one campaign on this page and nothing to
              tell apart, so it takes the brand's own tint and reads the same on
              every campaign, which is what the approved design shows.
            */}
            {/*
              `-ink-strong`, not `-ink`. The ordinary mint ink on the mint wash
              measures 4.31:1 against a 4.5:1 floor for 13px text — the kind of
              near-miss that passes an eye and fails WCAG 1.4.3.
            */}
            <span className="text-caption bg-wash-mint text-wash-mint-ink-strong inline-flex items-center rounded-full px-3 py-1 font-semibold">
              {campaign.category}
            </span>

            {/*
              THE STATUS, BUT ONLY WHEN IT IS NOT THE ORDINARY ONE.

              An active campaign says nothing — a badge reading "Active" beside
              every live appeal is noise. Paused, completed and archived all say
              so, because somebody who finds the quantity steppers disabled and
              no explanation assumes the page is broken rather than that the
              campaign has finished.

              This is the one thing the approved design does not show, and it
              does not show it because the campaign in the design is open.
            */}
            {campaign.status !== 'active' ? <StatusBadge status={campaign.status} /> : null}
          </div>

          <h1
            id="campaign-title"
            className="text-display mt-3 text-balance font-bold leading-[1.1]"
          >
            {campaign.title}
          </h1>

          <p className="text-body text-muted-foreground mt-3 max-w-prose leading-relaxed">
            {campaign.shortDescription}
          </p>

          <ul className="mt-6 flex flex-wrap items-start gap-x-8 gap-y-4">
            {campaign.location ? <Fact icon={MapPin} value={campaign.location} /> : null}

            {campaign.beneficiaryTarget ? (
              <Fact
                icon={Users}
                value={`${formatNumber(campaign.beneficiaryTarget)}+`}
                label="People in need"
              />
            ) : null}

            {period.length > 0 ? (
              <Fact icon={CalendarDays} value={period.join(' – ')} label="Campaign period" />
            ) : null}
          </ul>
        </div>
      </PageShell>

      {/* Below `lg` the photograph sits under the text rather than beside it. */}
      <div className="lg:hidden">
        <MediaFrame media={{ ...campaign.cover, alt: '' }} aspect="landscape" rounded={false} />
      </div>
    </section>
  );
}

/**
 * One fact, icon beside value.
 *
 * The value is the larger, bolder line and the label sits under it — the number
 * is what somebody scanning the band is looking for, and putting the caption
 * first buries it.
 */
function Fact({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  value: string;
  label?: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <Icon className="text-success size-5 shrink-0" aria-hidden={true} />
      <span className="min-w-0">
        <span data-numeric="" className="text-body-sm block font-semibold">
          {value}
        </span>
        {label ? <span className="text-caption text-muted-foreground block">{label}</span> : null}
      </span>
    </li>
  );
}
