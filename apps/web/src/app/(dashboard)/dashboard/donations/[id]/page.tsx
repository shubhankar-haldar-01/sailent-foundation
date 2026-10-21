import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle2, FileText, Heart, Sparkles } from 'lucide-react';

import { cn, formatCurrency, formatDate } from '@sailent/ui';

import { CopyButton } from '@/components/dashboard/copy-button';
import { ReceiptCard } from '@/components/dashboard/receipt-card';
import { StatusPill } from '@/components/dashboard/status-pill';
import { DonorApiError, donorFetch, type DonorDonationDetail } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Donation details',
  path: '/dashboard/donations',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

function getCategoryBadgeStyle(category: string | null | undefined): string {
  const cat = (category ?? '').toLowerCase();
  if (cat.includes('educat') || cat.includes('school')) {
    return 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300';
  }
  if (cat.includes('disaster') || cat.includes('relief') || cat.includes('emergency')) {
    return 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300';
  }
  if (cat.includes('health') || cat.includes('medical') || cat.includes('clinic')) {
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  if (cat.includes('livelihood') || cat.includes('women') || cat.includes('tailor')) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  }
  if (cat.includes('skill') || cat.includes('training') || cat.includes('youth')) {
    return 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300';
  }
  if (cat.includes('child') || cat.includes('nutrition') || cat.includes('welfare')) {
    return 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300';
  }
  if (cat.includes('water') || cat.includes('sanitat')) {
    return 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300';
  }
  if (cat.includes('environment') || cat.includes('forest') || cat.includes('green')) {
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

export default async function DonationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let donation: DonorDonationDetail;
  try {
    donation = await donorFetch<DonorDonationDetail>(`me/donations/${id}`);
  } catch (error) {
    if (error instanceof DonorApiError && error.status === 404) notFound();
    throw error;
  }

  const productLines = donation.items.filter((item) => item.itemType === 'product');
  const customLines = donation.items.filter((item) => item.itemType === 'custom');

  return (
    <div className="space-y-5">
      {/* ──────────────── Top Navigation ──────────────── */}
      <div>
        <Link
          href="/dashboard/donations"
          className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring inline-flex items-center gap-1.5 font-medium transition-colors focus-visible:outline-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>All donations</span>
        </Link>
      </div>

      {/* ──────────────── Card 1: Top Hero Card ──────────────── */}
      <div className="card-elevated relative rounded-2xl p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-primary text-[0.6875rem] font-bold uppercase tracking-wider">
              DONATION DETAILS
            </p>
            <h1 className="font-display text-foreground mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {formatCurrency(donation.amount)}
            </h1>
            <p className="font-display text-foreground mt-2 text-lg font-bold sm:text-xl">
              {donation.campaignTitle ?? 'General fund'}
            </p>
            {donation.campaignCategory ? (
              <div className="mt-2.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                    getCategoryBadgeStyle(donation.campaignCategory),
                  )}
                >
                  <Sparkles className="size-3" aria-hidden="true" />
                  <span>{donation.campaignCategory}</span>
                </span>
              </div>
            ) : null}
          </div>
          <div>
            <StatusPill status={donation.status} />
          </div>
        </div>

        {/* Notice for failed payments */}
        {donation.status === 'failed' ? (
          <div className="bg-destructive/10 border-destructive/20 mt-4 rounded-xl border p-3.5 text-xs text-rose-700 dark:text-rose-300">
            This payment was not completed, so nothing was charged. If your bank shows an amount
            held, they release it automatically within a few working days.
          </div>
        ) : null}
      </div>

      {/* ──────────────── Card 2: Payment Summary Card ──────────────── */}
      <div className="card-standard rounded-2xl p-6">
        <h2 className="font-display text-foreground text-base font-bold sm:text-lg">
          Payment summary
        </h2>
        <div className="divide-border/50 mt-4 divide-y">
          {/* Row 1: Donation reference */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <FileText className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <span className="text-body-sm text-foreground/80 font-medium">
                Donation reference
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm text-foreground font-mono font-semibold">
                {donation.reference}
              </span>
              <CopyButton text={donation.reference} label="Copy donation reference" />
            </div>
          </div>

          {/* Row 2: Donation date */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                <Calendar className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <span className="text-body-sm text-foreground/80 font-medium">Donation date</span>
            </div>
            <span className="text-body-sm text-foreground font-medium">
              {formatDate(donation.donationDate)}
            </span>
          </div>

          {/* Row 3: Payment confirmed */}
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="size-4.5 stroke-[2]" aria-hidden="true" />
              </div>
              <span className="text-body-sm text-foreground/80 font-medium">Payment confirmed</span>
            </div>
            <span className="text-body-sm text-foreground font-medium">
              {formatDate(donation.completedAt || donation.donationDate)}
            </span>
          </div>

          {/* Optional Row: Paid by (Method & Card) */}
          {donation.payment?.method ? (
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="size-9.5 flex shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
                  <Heart className="size-4.5 stroke-[2]" aria-hidden="true" />
                </div>
                <span className="text-body-sm text-foreground/80 font-medium">Paid by</span>
              </div>
              <span className="text-body-sm text-foreground font-medium">
                {donation.payment.cardLast4
                  ? `${donation.payment.method} ending in ${donation.payment.cardLast4}`
                  : donation.payment.method}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ──────────────── Card 3: Receipt Card ──────────────── */}
      <ReceiptCard
        donationId={donation.id}
        receiptNumber={donation.receiptNumber}
        paymentStatus={donation.status}
      />

      {/* ──────────────── What Was Bought (Preserved for full accounting) ──────────────── */}
      {donation.items.length > 0 ? (
        <section aria-labelledby="items-heading" className="card-standard rounded-2xl p-6">
          <h2
            id="items-heading"
            className="font-display text-foreground text-base font-bold sm:text-lg"
          >
            What this bought
          </h2>
          <ul className="border-border/60 divide-border/50 mt-3 divide-y rounded-xl border">
            {productLines.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="min-w-0">
                  <span className="text-body-sm text-foreground block font-semibold">
                    {item.itemName}
                  </span>
                  <span data-numeric="" className="text-caption text-muted-foreground">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </span>
                </span>
                <span
                  data-numeric=""
                  className="font-display text-body-sm text-foreground shrink-0 font-bold tabular-nums"
                >
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
            {customLines.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <span className="text-body-sm text-foreground font-semibold">
                  Additional amount
                </span>
                <span
                  data-numeric=""
                  className="font-display text-body-sm text-foreground shrink-0 font-bold tabular-nums"
                >
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ──────────────── Donor Message ──────────────── */}
      {donation.donorMessage ? (
        <section aria-labelledby="message-heading" className="card-standard rounded-2xl p-6">
          <h2 id="message-heading" className="font-display text-foreground text-base font-bold">
            Your message
          </h2>
          <p className="text-body-sm text-muted-foreground mt-2">{donation.donorMessage}</p>
        </section>
      ) : null}

      {/* ──────────────── Bottom Back Button ──────────────── */}
      <div className="pt-2">
        <Link
          href="/dashboard/donations"
          className="border-border/80 bg-surface hover:bg-muted text-foreground focus-visible:outline-ring shadow-xs px-4.5 inline-flex items-center gap-2 rounded-xl border py-2 text-sm font-semibold transition-colors focus-visible:outline-2"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to all donations</span>
        </Link>
      </div>
    </div>
  );
}
