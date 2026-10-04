import { CalendarDays, MapPin, Users } from 'lucide-react';

import { StatusBadge, cn, formatNumber } from '@sailent/ui';

import { MediaFrame } from '@/components/media/media-frame';
import type { Campaign } from '@/lib/mock/types';

/**
 * "01 Jun 2026" — the approved design's form. `formatDate`'s short style is
 * "01/06/26", which reads as a reference number and is ambiguous to anybody
 * used to month-first dates.
 */
const periodDate = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/**
 * The campaign header: the photograph, then what the campaign is.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOTHING IS WRITTEN ON THE PHOTOGRAPH.
 *
 * It used to carry a script slogan over a dark scrim. Whatever is set over a
 * picture is only as legible as the picture allows, it hides part of the one
 * thing a campaign team chose to show, and the title said it better anyway. The
 * photograph is now just the photograph, and every word sits below it on the
 * page's own background.
 *
 * It is `aria-hidden` with an empty alt for the same reason as before: the
 * title says what this is, and a second description of the same subject is an
 * interruption rather than an aid.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * THREE FACTS, AND ONLY ONES THE RECORD HOLDS. Location, people in need and the
 * campaign period each render only when the campaign actually carries them —
 * an empty "0 people in need" is worse than a shorter row (decision A14).
 */
export function CampaignHero({ campaign }: { campaign: Campaign }) {
  const period = [campaign.startsAt, campaign.endsAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => periodDate.format(new Date(value)));

  // "Ranchi, Jharkhand" is set as the design sets it: the place on the first
  // line and the state under it, so it matches the value-over-label rhythm of
  // the other two facts.
  const [place, ...region] = (campaign.location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <section aria-labelledby="campaign-title">
      {/*
        1000:567 at every width — the square the campaign team asked for, cut
        to 70% of its height and then by 10% twice more, so it is 56.7% as
        tall as it is wide. `aspect-[1000/567]` overrides the frame's square
        ratio (`cn` merges the two, and the later one wins). `object-cover` in
        the frame crops the photo to fit rather than letterboxing it.
      */}
      <MediaFrame
        media={{ ...campaign.cover, alt: '' }}
        aspect="square"
        priority
        className="aspect-[1000/567] rounded-xl"
        sizes="(max-width: 1024px) 100vw, 1000px"
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {/*
          `-ink-strong`, not `-ink`. The ordinary mint ink on the mint wash
          measures 4.31:1 against a 4.5:1 floor for 13px text — the kind of
          near-miss that passes an eye and fails WCAG 1.4.3.
        */}
        <span className="text-caption bg-wash-mint text-wash-mint-ink-strong inline-flex items-center rounded-md px-2.5 py-1 font-semibold">
          {campaign.category}
        </span>

        {/*
          THE STATUS, BUT ONLY WHEN IT IS NOT THE ORDINARY ONE. An active
          campaign says nothing; paused, completed and archived all say so,
          because somebody who finds the steppers disabled and no explanation
          assumes the page is broken rather than that the campaign has finished.
        */}
        {campaign.status !== 'active' ? <StatusBadge status={campaign.status} /> : null}
      </div>

      <h1 id="campaign-title" className="text-h1 mt-3 text-balance font-bold leading-tight">
        {campaign.title}
      </h1>

      <p className="text-body text-muted-foreground mt-2 max-w-3xl leading-relaxed md:text-[1.0625rem]">
        {campaign.shortDescription}
      </p>

      <ul className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-8 xl:gap-x-0">
        {place ? (
          <Fact
            icon={MapPin}
            tone="bg-wash-mint text-wash-mint-ink-strong"
            value={region.length > 0 ? `${place},` : place}
            label={region.length > 0 ? region.join(', ') : 'Location'}
          />
        ) : null}

        {campaign.beneficiaryTarget ? (
          <Fact
            icon={Users}
            tone="bg-wash-blue text-wash-blue-ink"
            value={`${formatNumber(campaign.beneficiaryTarget)}+`}
            label="People in need"
          />
        ) : null}

        {period.length > 0 ? (
          <Fact
            icon={CalendarDays}
            tone="bg-wash-mint text-wash-mint-ink-strong"
            value={period.join(' – ')}
            label="Campaign period"
          />
        ) : null}
      </ul>
    </section>
  );
}

/**
 * One fact: a tinted disc, then the value over its label.
 *
 * The value is the bolder line — the number is what somebody scanning the row
 * is looking for. The rule between facts is a border on every fact but the
 * first, so a campaign missing one of the three does not leave a stray divider.
 * It appears only at `xl`, the first width where all three always fit on one
 * line; narrower, the row wraps, and a rule would start the second line.
 */
function Fact({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <li className="xl:border-border flex items-center gap-3 xl:pr-8 xl:[&:not(:first-child)]:border-l xl:[&:not(:first-child)]:pl-8">
      <span
        aria-hidden="true"
        className={cn('grid size-11 shrink-0 place-items-center rounded-full', tone)}
      >
        <Icon className="size-5" aria-hidden={true} />
      </span>
      <span className="min-w-0">
        <span data-numeric="" className="text-body-sm block font-bold">
          {value}
        </span>
        <span className="text-caption text-muted-foreground block">{label}</span>
      </span>
    </li>
  );
}
