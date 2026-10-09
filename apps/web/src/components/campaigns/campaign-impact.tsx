import {
  BookOpen,
  CalendarCheck,
  Gift,
  MapPin,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@sailent/ui';

import type { Campaign } from '@/lib/mock/types';
import { SectionHeading } from '@/components/sections/section-heading';

/**
 * The difference your support can make — what the campaign has achieved, and
 * what a single gift does.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY FIGURES THE CAMPAIGN HAS REPORTED, AND NONE SAID TWICE.
 *
 * The cards are the campaign's `impactNotes` (up to four) — outcomes such as
 * districts covered or distribution days. Nothing is rounded up or given a "+"
 * it did not come with — a reported 354 is 354, not "350+" — and a campaign
 * with no figures says so plainly instead of showing an empty row.
 *
 * Two figures the page already states elsewhere are left out here: the
 * fundraising target (the donation card and "Our Goal") and the number of
 * people reached ("Your Impact"), including an impact note that only repeats
 * that count.
 *
 * Under the cards, what one gift does, from the campaign's own prices — the
 * outcome of an item, not another copy of the item cards above.
 *
 * The icon on each card is chosen from what its label says, so a figure about
 * districts does not sit under a drawing of a book. It is decoration either
 * way; the label carries the meaning.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignImpact({ campaign }: { campaign: Campaign }) {
  const cards: { value: string; unit?: string; label: string; icon: LucideIcon }[] =
    campaign.impactNotes
      .filter((note) => !repeatsPeopleReached(note, campaign.beneficiariesReached))
      .slice(0, 4)
      .map((note) => ({
        value: formatNumber(note.value),
        ...(note.unit ? { unit: note.unit } : {}),
        label: note.label,
        icon: iconFor(note.label),
      }));

  const examples = campaign.products
    .filter((product) => product.status === 'active' && product.unitAmount > 0)
    .slice(0, 3);

  return (
    <section id="campaign-impact" aria-labelledby="impact-heading" className="mt-12 scroll-mt-32">
      <SectionHeading
        id="impact-heading"
        size="md"
        title="The Difference Your Support Can Make"
        lead="Your contribution can create real and lasting change for the people this campaign serves."
      />

      {cards.length > 0 ? (
        <ul className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, index) => {
            const tone = CARD_TONES[index % CARD_TONES.length]!;
            return (
              <li
                key={card.label}
                className={cn('flex items-center gap-3 rounded-xl p-4', tone.card)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'bg-surface/80 grid size-11 shrink-0 place-items-center rounded-full',
                    tone.icon,
                  )}
                >
                  <card.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span
                    data-numeric=""
                    className="text-h3 block font-bold leading-tight tracking-tight"
                  >
                    {card.value}
                    {card.unit ? (
                      <span className="text-body-sm text-muted-foreground ml-1 font-normal">
                        {card.unit}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-caption text-muted-foreground-strong block">
                    {card.label}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {examples.length > 0 ? (
        <div className="border-border/70 bg-surface mt-4 rounded-xl border p-4">
          <h3 className="text-body font-bold">What one gift does</h3>
          <ul className="mt-2 space-y-1.5">
            {examples.map((product) => (
              <li key={product.id} className="text-body-sm text-foreground flex gap-2">
                <Gift className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span data-numeric="" className="font-bold tabular-nums">
                    {formatCurrency(product.unitAmount)}
                  </span>{' '}
                  provides one {product.name}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        Only when there is nothing to show. The measurement note and the list
        of progress updates that used to follow the cards were taken off the
        campaign page; the updates still have their own pages under /impact.
      */}
      {cards.length > 0 ? null : (
        <p className="text-body-sm text-muted-foreground mt-3">
          This campaign has not yet reported measurable outcomes. Updates are published as the work
          progresses.
        </p>
      )}
    </section>
  );
}

const CARD_TONES = [
  { card: 'bg-wash-blue/50', icon: 'text-wash-blue-ink' },
  { card: 'bg-wash-mint/50', icon: 'text-wash-mint-ink-strong' },
  { card: 'bg-wash-amber/50', icon: 'text-wash-amber-ink' },
  { card: 'bg-wash-rose/50', icon: 'text-wash-rose-ink' },
] as const;

const PEOPLE = /people|child|famil|student|patient|women|girl|boy|beneficiar|learner|member/;

/**
 * An impact note that is only the people-reached count again — a people label
 * carrying the same number "Your Impact" already shows.
 */
export function repeatsPeopleReached(
  note: { label: string; value: number },
  beneficiariesReached: number,
): boolean {
  return (
    beneficiariesReached > 0 &&
    note.value === beneficiariesReached &&
    PEOPLE.test(note.label.toLowerCase())
  );
}

function iconFor(label: string): LucideIcon {
  const text = label.toLowerCase();
  if (PEOPLE.test(text)) return Users;
  if (/kit|book|school|learn|class|reading|lesson/.test(text)) return BookOpen;
  if (/district|village|location|block|region|area|site|centre|center/.test(text)) return MapPin;
  if (/day|session|camp|event|week|month|visit/.test(text)) return CalendarCheck;
  return TrendingUp;
}
