import type { Metadata } from 'next';
import { FileText, Gift, Smartphone } from 'lucide-react';
import { formatCurrency } from '@sailent/ui';

import { ProfileForm } from '@/components/dashboard/profile-form';
import { ProfilePhotoCard } from '@/components/dashboard/profile-photo-card';
import { donorFetch, type DonorProfile } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Your profile',
  path: '/dashboard/profile',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await donorFetch<DonorProfile>('me');
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Donor';

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header: shown from `lg`; below it, read out but not drawn — the page's h1 must not disappear on a phone. */}
      <div className="relative overflow-hidden pb-2 pt-1 max-lg:sr-only">
        <p className="text-primary text-[0.6875rem] font-bold uppercase tracking-wider">
          MY ACCOUNT
        </p>
        <h1 className="font-display text-foreground mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Your profile
        </h1>
        <p className="text-body text-muted-foreground mt-1">
          How we address you and where we write to you.
        </p>
      </div>

      {/* ──────────────── Card 1: Profile Photo ──────────────── */}
      <ProfilePhotoCard initialAvatarUrl={profile.avatarUrl} name={displayName} />

      {/* ──────────────── Cards 2, 3, 4: Details, Address & Email ──────────────── */}
      <ProfileForm profile={profile} />

      {/* ──────────────── Card 5: Your Record ──────────────── */}
      <section aria-labelledby="record-heading" className="card-standard rounded-2xl p-6">
        <h2
          id="record-heading"
          className="font-display text-foreground text-lg font-bold sm:text-xl"
        >
          Your record
        </h2>
        <p className="text-body-sm text-muted-foreground mt-0.5">
          These are set by us and cannot be edited here.
        </p>

        <div className="divide-border/50 mt-4 divide-y">
          {/* Row 1: Donor Code */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <FileText className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-body-sm text-foreground font-medium">Donor code</p>
                <p className="text-caption text-muted-foreground">Quoted on your receipts.</p>
              </div>
            </div>
            <span className="text-body-sm text-foreground font-mono font-semibold">
              {profile.donorCode ?? '—'}
            </span>
          </div>

          {/* Row 2: Mobile Number */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                <Smartphone className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-body-sm text-foreground font-medium">Mobile number</p>
                <p className="text-caption text-muted-foreground">
                  This is how you sign in. To change it, contact us — we verify it rather than take
                  it from a form.
                </p>
              </div>
            </div>
            <span className="text-body-sm text-foreground font-mono font-semibold">
              {profile.phone ?? '—'}
            </span>
          </div>

          {/* Row 3: Total Given */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 text-primary dark:text-primary-foreground flex shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/40">
                <Gift className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-body-sm text-foreground font-medium">Total given</p>
                <p className="text-caption text-muted-foreground">
                  Across {profile.donationCount}{' '}
                  {profile.donationCount === 1 ? 'donation' : 'donations'}.
                </p>
              </div>
            </div>
            <span className="font-display text-body-sm text-foreground font-bold tabular-nums">
              {formatCurrency(profile.totalDonated)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
