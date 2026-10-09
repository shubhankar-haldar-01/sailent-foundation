import type { Metadata } from 'next';

import { formatCurrency, formatDate } from '@sailent/ui';

import { ProfileForm } from '@/components/dashboard/profile-form';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your profile',
  path: '/dashboard/profile',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

/**
 * The donor's own details.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IS SHOWN BUT NOT EDITABLE IS AS DELIBERATE AS WHAT IS.
 *
 *   Donor code      assigned once and quoted on receipts
 *   Phone number    the sign-in identifier — someone who could change their own
 *                   would be able to point the account at a number they control
 *   Lifetime totals written only by the payment-capture transaction (A6)
 *
 * They are displayed because a donor should be able to see what is held about
 * them, and they are read-only because none of them is theirs to set by
 * submitting a form. The page says WHY rather than just refusing, so that
 * somebody who genuinely needs a number changed knows to ask.
 * ══════════════════════════════════════════════════════════════════════════
 */
export default async function ProfilePage() {
  const profile = await donorFetch<DonorProfile>('me');

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-h1 font-bold">Your profile</h1>
        <p className="text-body text-muted-foreground mt-2">
          How we address you, where we write to you, and the tax identification we need for the
          annual filing.
        </p>
      </header>

      <ProfileForm profile={profile} />

      <section aria-labelledby="record-heading" className="border-border border-t pt-6">
        <h2 id="record-heading" className="text-h3 font-semibold">
          Your record
        </h2>
        <p className="text-body-sm text-muted-foreground mt-1">
          These are set by us and cannot be edited here.
        </p>

        <dl className="border-border divide-border mt-4 divide-y rounded-lg border">
          <Row
            label="Donor code"
            value={profile.donorCode ?? '—'}
            hint="Quoted on your receipts."
            mono
          />
          <Row
            label="Mobile number"
            value={profile.phone ?? '—'}
            hint="This is how you sign in. To change it, contact us — we verify it rather than take it from a form."
            mono
          />
          <Row
            label="Total given"
            value={formatCurrency(profile.totalDonated)}
            hint={`Across ${profile.donationCount} ${profile.donationCount === 1 ? 'donation' : 'donations'}.`}
            mono
          />
          {profile.firstDonatedAt ? (
            <Row label="First donation" value={formatDate(profile.firstDonatedAt)} />
          ) : null}
        </dl>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  mono,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  // A `<dl>` may hold `<div>`s, and each must contain only its `<dt>` and
  // `<dd>`; the hint therefore lives inside the `<dd>` (WCAG 1.3.1 — axe's
  // `definition-list` rule flagged the earlier `<p>` beside them).
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-caption text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-body-sm min-w-0 flex-1 text-right font-medium">
        <span {...(mono ? { 'data-numeric': '' } : {})} className="break-words">
          {value}
        </span>
        {hint ? (
          <span className="text-caption text-muted-foreground mt-1 block text-left font-normal">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
