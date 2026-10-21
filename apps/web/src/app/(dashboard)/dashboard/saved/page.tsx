import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Calendar } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import { EmptyState } from '@/components/dashboard/empty-state';
import { UnsaveButton } from '@/components/dashboard/save-campaign-button';
import { donorFetch, type Paginated, type SavedCampaign } from '@/lib/donor/api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Saved campaigns',
  path: '/dashboard/saved',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

function formatSavedDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getCampaignImageUrl(campaign: { coverImage: string | null; slug: string }): string {
  if (campaign.coverImage) return campaign.coverImage;
  if (campaign.slug === 'women-livelihoods-ranchi') {
    return '/images/campaign-women-livelihoods-ranchi.webp';
  }
  if (campaign.slug === 'school-kits-jharkhand') {
    return '/images/campaign-school-kits-jharkhand.webp';
  }
  if (campaign.slug.includes('flood') || campaign.slug.includes('relief')) {
    return '/images/campaign-flood-relief-balasore.webp';
  }
  if (campaign.slug.includes('health') || campaign.slug.includes('clinic')) {
    return '/images/05_healthcare.webp';
  }
  if (campaign.slug.includes('skill')) {
    return '/images/campaign-skills-training-second-cohort.webp';
  }
  if (campaign.slug.includes('nutrition') || campaign.slug.includes('child')) {
    return '/images/campaign-child-nutrition-gaya.webp';
  }
  return '/images/02_about_group.webp';
}

/**
 * Campaigns saved to come back to (redesigned to match owner mockups, 2026-10-09).
 */
export default async function SavedCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page ?? '1') || 1);
  const result = await donorFetch<Paginated<SavedCampaign>>('me/saved-campaigns', {
    query: { page, limit: 20 },
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header: shown from `lg`; below it, read out but not drawn — the page's h1 must not disappear on a phone. */}
      <header className="relative max-lg:sr-only">
        <h1 className="font-display text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          Saved campaigns
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Campaigns you have kept to come back to.
        </p>
      </header>

      {/* ──────────────── Saved List or Empty State ──────────────── */}
      {result.items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Save a campaign from its page and it will be waiting here when you are ready."
          action={{ label: 'Browse campaigns', href: '/campaigns' }}
        />
      ) : (
        <ul className="space-y-4 sm:space-y-5">
          {result.items.map((campaign) => {
            const closed = campaign.status === 'completed' || campaign.status === 'archived';
            const paused = campaign.status === 'paused';
            const imageUrl = getCampaignImageUrl(campaign);
            const percent =
              campaign.fundraisingGoal && campaign.fundraisingGoal > 0
                ? Math.min(
                    100,
                    Math.round((campaign.amountRaised / campaign.fundraisingGoal) * 100),
                  )
                : 0;

            const categoryName =
              campaign.category ||
              (campaign.slug.includes('women')
                ? 'Women Empowerment'
                : campaign.slug.includes('school') || campaign.slug.includes('educat')
                  ? 'Education'
                  : 'Community Support');

            return (
              <li key={campaign.campaignId}>
                <div className="card-interactive rounded-2xl p-4 sm:p-6">
                  <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:gap-6">
                    {/* Campaign Photo with Floating Trash Button on Mobile */}
                    <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:aspect-[4/3] sm:w-60 md:w-64 lg:w-72 dark:bg-slate-800">
                      <Image
                        src={imageUrl}
                        alt={campaign.title}
                        fill
                        sizes="(min-width: 1024px) 288px, (min-width: 640px) 240px, 100vw"
                        className="object-cover"
                      />
                      {/* Floating Trash Button top-right on the photo for mobile */}
                      <div className="absolute right-3 top-3 z-10 sm:hidden">
                        <UnsaveButton
                          campaignId={campaign.campaignId}
                          title={campaign.title}
                          className="text-primary bg-white/95 shadow-md dark:bg-slate-900"
                        />
                      </div>
                    </div>

                    {/* Right: Campaign Content */}
                    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <div>
                        {/* Category Pill matching Mockup 2 */}
                        <div className="mb-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold',
                              categoryName.toLowerCase().includes('women')
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300'
                                : categoryName.toLowerCase().includes('educat')
                                  ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300'
                                  : 'text-primary bg-orange-50 dark:bg-orange-950/50 dark:text-orange-300',
                            )}
                          >
                            {categoryName}
                          </span>
                        </div>

                        {/* Title and Unsave Action Button (desktop) */}
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="font-display text-foreground text-lg font-bold leading-snug tracking-tight sm:text-xl">
                            <Link
                              href={`/campaigns/${campaign.slug}`}
                              className="hover:text-primary focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2"
                            >
                              {campaign.title}
                            </Link>
                          </h2>
                          <div className="hidden sm:block">
                            <UnsaveButton campaignId={campaign.campaignId} title={campaign.title} />
                          </div>
                        </div>

                        {/* Description */}
                        {campaign.shortDescription ? (
                          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed sm:text-sm">
                            {campaign.shortDescription}
                          </p>
                        ) : null}

                        {/* Saved Date with Calendar Icon */}
                        <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs font-medium sm:text-[0.8125rem]">
                          <Calendar
                            className="text-muted-foreground/80 size-3.5 stroke-[1.8] sm:size-4"
                            aria-hidden="true"
                          />
                          <span>Saved {formatSavedDate(campaign.savedAt)}</span>
                        </div>
                      </div>

                      {/* Progress, Amounts & CTA */}
                      <div className="mt-4 space-y-3">
                        {campaign.fundraisingGoal ? (
                          <div className="space-y-2">
                            {/* Progress bar + percentage */}
                            <div className="flex items-center gap-3.5">
                              <div
                                role="progressbar"
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Progress: ${percent}%`}
                                className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F2F5] sm:h-2.5 dark:bg-slate-800"
                              >
                                <div
                                  className="h-full rounded-full bg-[#EB6A1F] transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="font-display text-foreground shrink-0 text-xs font-bold tabular-nums sm:text-sm">
                                {percent}%
                              </span>
                            </div>

                            {/* Raised of Goal */}
                            <p className="text-xs sm:text-sm">
                              <strong className="font-display text-foreground font-bold tabular-nums">
                                {formatCurrency(campaign.amountRaised)}
                              </strong>
                              <span className="text-muted-foreground">
                                {' '}
                                raised of {formatCurrency(campaign.fundraisingGoal)}
                              </span>
                            </p>
                          </div>
                        ) : null}

                        {/* Donate button / status note */}
                        <div>
                          {closed ? (
                            <p className="text-muted-foreground text-xs font-medium sm:text-sm">
                              This campaign has finished. Thank you for following it.
                            </p>
                          ) : paused ? (
                            <p className="text-muted-foreground text-xs font-medium sm:text-sm">
                              This campaign is paused and is not accepting donations right now.
                            </p>
                          ) : (
                            <Link
                              href={`/campaigns/${campaign.slug}#give`}
                              className="focus-visible:outline-ring shadow-xs text-primary-foreground inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#EB6A1F] px-6 py-2.5 text-xs font-semibold transition-all hover:bg-[#d65e1b] focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 sm:w-auto sm:text-sm"
                            >
                              <span>Donate</span>
                              <ArrowRight
                                className="size-3.5 stroke-[2.2] sm:size-4"
                                aria-hidden="true"
                              />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ──────────────── Pagination ──────────────── */}
      {result.pagination.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4 pt-2">
          {page > 1 ? (
            <Link
              href={`/dashboard/saved?page=${page - 1}`}
              className="text-info-action focus-visible:outline-ring text-body-sm rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-caption text-muted-foreground">
            Page {page} of {result.pagination.totalPages}
          </span>
          {result.pagination.hasNext ? (
            <Link
              href={`/dashboard/saved?page=${page + 1}`}
              className="text-info-action focus-visible:outline-ring text-body-sm rounded-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
