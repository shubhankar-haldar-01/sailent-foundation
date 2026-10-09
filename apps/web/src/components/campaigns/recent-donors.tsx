'use client';

import * as React from 'react';

import { cn, formatCurrency } from '@sailent/ui';

import { SectionHeading } from '@/components/sections/section-heading';

export interface CampaignDonor {
  name: string;
  anonymous: boolean;
  /** Paise. */
  amount: number;
  donatedAt: string | null;
}

/**
 * Who recently gave.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE ANONYMITY DECISION IS THE API'S, AND THIS COMPONENT DOES NOT SECOND-GUESS
 * IT.
 *
 * `GET /campaigns/:slug/donors` returns the literal 'Anonymous Donor' for a
 * hidden gift — the real name is never read out of the database. So there is no
 * conditional here that decides what to show: this renders `name`, whatever it
 * is. Any masking logic in this file would imply the server sent something that
 * needed masking, and one day it would be the only thing doing it.
 *
 * The initials come from the SAME string for the same reason. Deriving them
 * from a separate field would put "RK" beside "Anonymous Donor".
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The two views are a client-side re-sort of one fetched list, not two
 * requests. Five rows do not justify a round trip, and the toggle then responds
 * instantly rather than flashing a spinner at somebody who is browsing.
 */
/**
 * The avatar discs.
 *
 * TINTED BACKGROUND, DARK INK — not the matching ink for each wash.
 *
 * Pairing each wash with its own ink looked right and measured 4.24–4.36:1
 * against a 4.5:1 floor for 13px text. Close enough to pass an eye and fail
 * WCAG 1.4.3, which is the kind axe catches and nobody else does. The discs
 * still read as five different colours; only the two letters changed.
 */
const AVATAR_TONES = [
  'bg-wash-violet',
  'bg-wash-amber',
  'bg-wash-mint',
  'bg-wash-pink',
  'bg-wash-blue',
] as const;

/** Up to two letters, from whatever the server chose to call this donor. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** "2 hours ago". Absolute dates are noise on a list whose point is recency. */
function relativeTime(value: string | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return 'just now';
}

export function RecentDonors({ donors }: { donors: CampaignDonor[] }) {
  const [view, setView] = React.useState<'recent' | 'generous'>('recent');

  const rows = React.useMemo(() => {
    if (view === 'recent') return donors;
    return [...donors].sort((a, b) => b.amount - a.amount);
  }, [donors, view]);

  if (donors.length === 0) return null;

  /*
    A radio group, not two buttons. These are mutually exclusive views of one
    list, and `aria-pressed` on a pair of toggles announces two independent
    switches — one of which is always on.
  */
  const sortControl = (
    <div
      role="radiogroup"
      aria-label="Sort supporters"
      className="border-border bg-surface flex rounded-lg border p-0.5"
    >
      {(
        [
          ['recent', 'Recent'],
          ['generous', 'Most Generous'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={view === value}
          onClick={() => setView(value)}
          className={cn(
            'text-caption focus-visible:outline-ring min-h-8 rounded-md px-3 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
            view === value
              ? 'bg-wash-mint text-wash-mint-ink-strong'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <section
      id="campaign-supporters"
      aria-labelledby="donors-heading"
      className="mt-12 scroll-mt-32"
    >
      <SectionHeading
        id="donors-heading"
        size="md"
        title="Recent Supporters"
        lead="People who recently supported this campaign."
        action={sortControl}
      />

      {/*
        WHO AND WHEN TOGETHER, HOW MUCH AT THE END. The time sits under the
        name rather than in a column of its own halfway across the row, so the
        eye reads one person's line without travelling; the amount is set in
        the page's green, the colour it gives to money given.
      */}
      <ul className="border-border bg-surface divide-border mt-4 divide-y overflow-hidden rounded-xl border shadow-sm">
        {rows.map((donor, index) => (
          <li
            key={`${donor.name}-${donor.donatedAt ?? index}`}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                'text-caption text-foreground grid size-10 shrink-0 place-items-center rounded-full font-bold',
                AVATAR_TONES[index % AVATAR_TONES.length],
              )}
            >
              {initialsOf(donor.name)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="text-body block truncate font-semibold">{donor.name}</span>
              {donor.donatedAt ? (
                <time
                  dateTime={donor.donatedAt}
                  className="text-caption text-muted-foreground block"
                >
                  {relativeTime(donor.donatedAt)}
                </time>
              ) : null}
            </span>

            <span
              data-numeric=""
              className="text-body text-success shrink-0 font-bold tabular-nums"
            >
              {/* Paise only when there are any: "₹500", but "₹319.50". */}
              {formatCurrency(donor.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
