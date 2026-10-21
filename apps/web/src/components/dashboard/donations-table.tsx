'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { ArrowUpDown, FileText, Heart } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import { categoryTone } from '@/components/home/category-icon';
import type { DonorDonation } from '@/lib/donor/api';
import { formatDayMonthYear } from './format';
import { StatusPill } from './status-pill';

interface DonationsTableProps {
  donations: DonorDonation[];
  currentSort?: string;
}

function getCategoryBadgeStyle(category: string | null | undefined): string {
  return categoryTone(category).chip;
}

function getCampaignThumbnailUrl(donation: DonorDonation): string {
  if (donation.campaignCoverImage) return donation.campaignCoverImage;

  const text = `${donation.campaignTitle ?? ''} ${donation.campaignCategory ?? ''}`.toLowerCase();
  if (text.includes('educat') || text.includes('school')) {
    return '/images/campaign-school-kits-jharkhand.webp';
  }
  if (text.includes('flood') || text.includes('relief') || text.includes('disaster')) {
    return '/images/campaign-flood-relief-balasore.webp';
  }
  if (text.includes('health') || text.includes('clinic') || text.includes('medical')) {
    return '/images/05_healthcare.webp';
  }
  if (text.includes('tailor') || text.includes('women') || text.includes('livelihood')) {
    return '/images/campaign-women-livelihoods-ranchi.webp';
  }
  if (text.includes('skill') || text.includes('training') || text.includes('youth')) {
    return '/images/campaign-skills-training-second-cohort.webp';
  }
  if (text.includes('child') || text.includes('nutrition')) {
    return '/images/campaign-child-nutrition-gaya.webp';
  }
  if (text.includes('water') || text.includes('clean')) {
    return '/images/community-volunteers.webp';
  }
  if (text.includes('forest') || text.includes('environment') || text.includes('tree')) {
    return '/images/campaign-greener-communities-bhopal.webp';
  }
  return '/images/02_about_group.webp';
}

function CampaignThumbnail({ donation }: { donation: DonorDonation }) {
  const [hasError, setHasError] = useState(false);
  const src = getCampaignThumbnailUrl(donation);

  if (hasError) {
    return (
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Heart className="size-4" />
      </div>
    );
  }

  return (
    <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      <Image
        src={src}
        alt={donation.campaignTitle ?? 'Campaign thumbnail'}
        fill
        sizes="36px"
        className="object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function DonationsTable({ donations, currentSort = '-donationDate' }: DonationsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const toggleSort = useCallback(
    (field: 'donationDate' | 'amount') => {
      const isCurrentField =
        currentSort === field ||
        currentSort === `-${field}` ||
        (field === 'donationDate' && (currentSort === 'date' || currentSort === '-date'));

      const isCurrentDesc = currentSort.startsWith('-');
      const newSort = isCurrentField && isCurrentDesc ? field : `-${field}`;

      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('sort', newSort);
      params.delete('page');

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [currentSort, pathname, router, searchParams],
  );

  return (
    <div className="card-standard overflow-hidden rounded-2xl">
      {/* ──────────────── Desktop Table (md and up) ──────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-border/60 text-caption text-muted-foreground/80 border-b font-medium">
              <th scope="col" className="py-2.5 pl-5 pr-3 text-xs font-semibold">
                Campaign
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort('donationDate')}
                  disabled={isPending}
                  className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors focus:outline-none"
                  aria-label="Sort by date"
                >
                  <span>Date</span>
                  <ArrowUpDown className="size-3.5 opacity-60" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold">
                Transaction ID
              </th>
              <th scope="col" className="px-3 py-2.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => toggleSort('amount')}
                  disabled={isPending}
                  className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors focus:outline-none"
                  aria-label="Sort by amount"
                >
                  <span>Amount</span>
                  <ArrowUpDown className="size-3.5 opacity-60" aria-hidden="true" />
                </button>
              </th>
              <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold">
                Receipt
              </th>
              <th scope="col" className="py-2.5 pl-3 pr-5 text-right text-xs font-semibold">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-border/50 divide-y">
            {donations.map((donation) => {
              const hasReceipt = Boolean(donation.receiptId || donation.receiptNumber);

              return (
                <tr key={donation.id} className="hover:bg-muted/30 group transition-colors">
                  {/* Campaign Column */}
                  <td className="py-2.5 pl-5 pr-3 align-middle xl:py-2">
                    <div className="flex items-center gap-3">
                      <CampaignThumbnail donation={donation} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/donations/${donation.id}`}
                          className="text-foreground hover:text-primary focus-visible:outline-ring line-clamp-1 text-sm font-bold transition-colors focus-visible:outline-2"
                        >
                          {donation.campaignTitle ?? 'General fund'}
                        </Link>
                        {donation.campaignCategory ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                              getCategoryBadgeStyle(donation.campaignCategory),
                            )}
                          >
                            {donation.campaignCategory}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {/* Date Column */}
                  <td className="text-body-sm text-muted-foreground whitespace-nowrap px-3 py-2.5 align-middle xl:py-2">
                    {formatDayMonthYear(donation.donationDate)}
                  </td>

                  {/* Transaction ID Column */}
                  <td className="whitespace-nowrap px-3 py-2.5 align-middle xl:py-2">
                    <Link
                      href={`/dashboard/donations/${donation.id}`}
                      className="text-body-sm text-muted-foreground hover:text-foreground focus-visible:outline-ring font-mono transition-colors focus-visible:outline-2"
                    >
                      {donation.reference}
                    </Link>
                  </td>

                  {/* Amount Column */}
                  <td className="font-display text-foreground whitespace-nowrap px-3 py-2.5 align-middle text-sm font-bold tabular-nums xl:py-2">
                    {formatCurrency(donation.amount)}
                  </td>

                  {/* Status Column */}
                  <td className="px-3 py-2.5 text-center align-middle xl:py-2">
                    <StatusPill status={donation.status} />
                  </td>

                  {/* Receipt Column */}
                  <td className="px-3 py-2.5 text-center align-middle xl:py-2">
                    {hasReceipt ? (
                      <Link
                        href={`/dashboard/donations/${donation.id}/receipt`}
                        aria-label={`View receipt for ${donation.reference}`}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-ring border-border/80 size-7.5 inline-flex items-center justify-center rounded-lg border transition-colors focus-visible:outline-2"
                      >
                        <FileText className="size-3.5 stroke-[1.8]" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="text-muted-foreground/40 border-border/40 size-7.5 inline-flex cursor-not-allowed items-center justify-center rounded-lg border"
                      >
                        <FileText className="size-3.5 stroke-[1.8]" aria-hidden="true" />
                      </span>
                    )}
                  </td>

                  {/* Action Column */}
                  <td className="py-2.5 pl-3 pr-5 text-right align-middle xl:py-2">
                    <Link
                      href={`/dashboard/donations/${donation.id}`}
                      className="text-primary border-primary/30 hover:bg-primary/10 focus-visible:outline-ring inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold transition-all focus-visible:outline-2"
                    >
                      <span>View</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ──────────────── Mobile Cards View (< md) ──────────────── */}
      <div className="divide-border/50 divide-y md:hidden">
        {donations.map((donation) => {
          const hasReceipt = Boolean(donation.receiptId || donation.receiptNumber);

          return (
            <div key={donation.id} className="space-y-3 p-4">
              {/* Header: Thumbnail + Title + Category + Status */}
              <div className="flex items-start gap-3">
                <CampaignThumbnail donation={donation} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/donations/${donation.id}`}
                      className="text-foreground hover:text-primary line-clamp-1 text-sm font-bold"
                    >
                      {donation.campaignTitle ?? 'General fund'}
                    </Link>
                    <StatusPill status={donation.status} />
                  </div>
                  {donation.campaignCategory ? (
                    <div className="mt-1">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                          getCategoryBadgeStyle(donation.campaignCategory),
                        )}
                      >
                        {donation.campaignCategory}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Middle row: Reference & Date */}
              <div className="text-muted-foreground flex items-center justify-between pt-1 text-xs">
                <Link
                  href={`/dashboard/donations/${donation.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {donation.reference}
                </Link>
                <span>{formatDayMonthYear(donation.donationDate)}</span>
              </div>

              {/* Bottom row: Amount & Actions */}
              <div className="border-border/40 flex items-center justify-between border-t pt-1">
                <span className="font-display text-foreground text-base font-bold tabular-nums">
                  {formatCurrency(donation.amount)}
                </span>
                <div className="flex items-center gap-2">
                  {hasReceipt ? (
                    <Link
                      href={`/dashboard/donations/${donation.id}/receipt`}
                      aria-label={`View receipt for ${donation.reference}`}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted border-border/80 inline-flex size-8 items-center justify-center rounded-lg border transition-colors"
                    >
                      <FileText className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/dashboard/donations/${donation.id}`}
                    className="text-primary border-primary/30 hover:bg-primary/10 inline-flex items-center gap-1 rounded-full border px-3.5 py-1 text-xs font-bold transition-all"
                  >
                    <span>View</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
