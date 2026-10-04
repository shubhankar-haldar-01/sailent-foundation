import {
  BookOpen,
  CalendarCheck,
  Heart,
  MapPin,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { cn, formatCurrency, formatNumber } from '@sailent/ui';

import type { Campaign } from '@/lib/mock/types';
import { SectionHeading } from '@/components/sections/section-heading';

/**
 * The difference your support can make — the campaign's own figures, then its
 * target.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONLY FIGURES THE CAMPAIGN HAS REPORTED.
 *
 * The cards are the campaign's `impactNotes` (up to three), topped up with
 * people reached when that has been counted, and closed with the fundraising
 * target. Nothing is rounded up or given a "+" it did not come with — a
 * reported 354 is 354, not "350+" — and a campaign with no figures says so
 * plainly instead of showing an empty row.
 *
 * The icon on each card is chosen from what its label says, so a figure about
 * districts does not sit under a drawing of a book. It is decoration either
 * way; the label carries the meaning.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function CampaignImpact({ campaign }: { campaign: Campaign }) {
  const cards: { value: string; unit?: string; label: string; icon: LucideIcon }[] =
    campaign.impactNotes.slice(0, 3).map((note) => ({
      value: formatNumber(note.value),
      ...(note.unit ? { unit: note.unit } : {}),
      label: note.label,
      icon: iconFor(note.label),
    }));

  if (cards.length < 3 && campaign.beneficiariesReached > 0) {
    cards.push({
      value: formatNumber(campaign.beneficiariesReached),
      label: 'People reached',
      icon: Users,
    });
  }

  const hasReportedFigures = cards.length > 0;

  if (campaign.goalAmount > 0) {
    cards.push({
      value: formatCurrency(campaign.goalAmount),
      label: 'Campaign target',
      icon: Heart,
    });
  }

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
            // The target is always the rose card, wherever it lands.
            const isTarget = card.label === 'Campaign target' && index === cards.length - 1;
            const tone = isTarget ? CARD_TONES[3]! : CARD_TONES[index % 3]!;
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
                    className="text-h3 block font-extrabold leading-tight tracking-tight"
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

      {/*
        Only when there is nothing to show. The measurement note and the list
        of progress updates that used to follow the cards were taken off the
        campaign page; the updates still have their own pages under /impact.
      */}
      {hasReportedFigures ? null : (
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

function iconFor(label: string): LucideIcon {
  const text = label.toLowerCase();
  if (/people|child|famil|student|patient|women|girl|boy|beneficiar|learner|member/.test(text)) {
    return Users;
  }
  if (/kit|book|school|learn|class|reading|lesson/.test(text)) return BookOpen;
  if (/district|village|location|block|region|area|site|centre|center/.test(text)) return MapPin;
  if (/day|session|camp|event|week|month|visit/.test(text)) return CalendarCheck;
  return TrendingUp;
}
