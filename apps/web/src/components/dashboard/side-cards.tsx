import Link from 'next/link';
import { ArrowRight, Pencil } from 'lucide-react';

import { Button } from '@sailent/ui';

import type { DonorImpact, DonorProfile } from '@/lib/donor/api';

import {
  CalendarSolid,
  ExploreLeaves,
  LeafSolid,
  PhoneSolid,
  PinSolid,
  SproutIllustration,
} from './decor';
import { DonorAvatar } from './donor-avatar';
import { donorDisplayName, formatMonthYear, formatPhone } from './format';
import { Panel, PanelHeader } from './panel';

/**
 * The right-hand column (design, 2026-10-08): the profile card, "Your
 * Impact", "Explore More Campaigns", and — when the donor's gifts bought
 * things — what they were.
 */

export function ProfileCard({ profile }: { profile: DonorProfile }) {
  const name = donorDisplayName(profile);
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const since = profile.createdAt ?? profile.firstDonatedAt;

  // Each row only when there is something to say — nothing is invented.
  const rows = [
    profile.phone
      ? { icon: PhoneSolid, label: 'Phone', value: formatPhone(profile.phone), numeric: true }
      : null,
    location ? { icon: PinSolid, label: 'Location', value: location } : null,
    since
      ? {
          icon: CalendarSolid,
          label: 'Member since',
          value: `Member since ${formatMonthYear(since)}`,
        }
      : null,
  ].filter((row) => row !== null);

  return (
    <Panel className="p-5 sm:p-[1.375rem]">
      <section aria-labelledby="profile-heading">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="profile-heading"
            className="font-display text-foreground text-[1.0625rem] font-bold tracking-[-0.01em]"
          >
            My Profile
          </h2>
          <Link
            href="/dashboard/profile"
            aria-label="Edit your profile"
            className="text-primary focus-visible:outline-ring inline-flex min-h-8 items-center gap-1.5 rounded-sm text-[0.9375rem] font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3.5">
          <DonorAvatar name={name} className="size-[3.625rem] text-[1.0625rem]" />
          <div className="min-w-0">
            <p className="font-display text-foreground truncate text-[0.9375rem] font-bold">
              {name || 'Your account'}
            </p>
            {profile.email ? (
              <p className="text-muted-foreground mt-0.5 break-all text-[0.875rem]">
                {profile.email}
              </p>
            ) : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <dl className="mt-7 space-y-5">
            {rows.map(({ icon: Icon, label, value, numeric }) => (
              <div key={label} className="flex items-center gap-3.5">
                <Icon className="text-foreground/80 size-[1.375rem] shrink-0" />
                <dt className="sr-only">{label}</dt>
                <dd
                  {...(numeric ? { 'data-numeric': '' } : {})}
                  className="text-foreground min-w-0 break-words text-[0.9375rem]"
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-body-sm text-muted-foreground mt-6">
            Add your phone number and address on{' '}
            <Link href="/dashboard/profile" className="text-primary font-semibold hover:underline">
              your profile
            </Link>
            .
          </p>
        )}
      </section>
    </Panel>
  );
}

export function ImpactCard() {
  return (
    <section
      aria-labelledby="impact-heading"
      className="bg-success-subtle relative overflow-hidden rounded-2xl p-5 sm:p-[1.375rem]"
    >
      <SproutIllustration className="absolute -right-1 bottom-0 h-[8.5rem] w-auto dark:opacity-70" />
      <div className="relative">
        <h2
          id="impact-heading"
          className="font-display text-foreground flex items-center gap-2.5 text-[1.0625rem] font-bold tracking-[-0.01em]"
        >
          <LeafSolid className="text-success size-[1.625rem] shrink-0" />
          Your Impact
        </h2>
        <p className="text-foreground mt-3 max-w-[9.25rem] text-[0.9375rem] leading-normal">
          You&rsquo;re helping build stronger, healthier and happier communities.
        </p>
      </div>
    </section>
  );
}

export function ExploreCard() {
  return (
    <section
      aria-labelledby="explore-heading"
      className="dark:bg-primary-soft bg-(--cta-50) relative overflow-hidden rounded-2xl p-5 pb-8 sm:p-[1.375rem] sm:pb-9"
    >
      <ExploreLeaves className="absolute bottom-0 right-0 h-[7.25rem] w-auto dark:opacity-60" />
      <div className="relative">
        <h2
          id="explore-heading"
          className="font-display text-foreground text-[1.0625rem] font-bold tracking-[-0.01em]"
        >
          Explore More Campaigns
        </h2>
        <p className="text-foreground/85 mt-2.5 max-w-[12.5rem] text-[0.9375rem] leading-[1.4]">
          Support more causes and create a bigger impact.
        </p>
        {/*
          The design draws a white label; the owner's contrast rule (AGENTS.md
          §11) gives buttons on #EB6A1F a navy one, as everywhere else.
        */}
        <Button asChild size="md" className="mt-5 h-[2.625rem] rounded-full px-6 text-[0.9375rem]">
          <Link href="/campaigns">
            Browse Campaigns
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

/**
 * What the donor's gifts bought — counted from their own donations' line
 * items (decision A14), never a share of anyone else's.
 */
export function FundedItemsCard({ items }: { items: DonorImpact['itemsProvided'] }) {
  if (items.length === 0) return null;
  return (
    <Panel className="p-5 sm:p-6">
      <section aria-labelledby="items-heading">
        <PanelHeader id="items-heading" title="What you funded" />
        <p className="text-caption text-muted-foreground mt-1">Counted from your own donations.</p>
        <ul className="divide-border/70 mt-3 divide-y">
          {items.map((item) => (
            <li key={item.itemName} className="flex items-baseline justify-between gap-4 py-2.5">
              <span className="text-body-sm min-w-0 font-medium">{item.itemName}</span>
              <span data-numeric="" className="text-body-sm shrink-0 font-semibold tabular-nums">
                {item.quantity}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Panel>
  );
}
