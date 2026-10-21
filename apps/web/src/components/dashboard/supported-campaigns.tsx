import Link from 'next/link';
import { ArrowRight, Heart } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import { CategoryIcon, categoryTone } from '@/components/home/category-icon';
import { MediaFrame } from '@/components/media/media-frame';
import type { SupportedCampaign } from '@/lib/donor/api';
import type { MediaRef } from '@/lib/mock/types';

import { EmptyState } from './empty-state';
import { fitRow } from './fit';
import { formatDayMonthYear } from './format';
import { Panel, PanelHeader } from './panel';
import { PanelLink } from './recent-payments';

/**
 * "Campaigns You've Supported" (design, 2026-10-08) — on the dashboard
 * itself; there is no separate page any more (owner decision). On a desktop
 * it shows as many rows as fit the screen (`fit.ts`).
 *
 * CONFIRMED DONATIONS ONLY, and "₹" here is what THIS donor gave to the
 * campaign, not what the campaign has raised — the page it links to shows the
 * campaign's own totals.
 */
export function SupportedCampaigns({
  campaigns,
}: {
  /** The most recently supported first; `covers` resolved by the page. */
  campaigns: (SupportedCampaign & { cover: MediaRef })[];
}) {
  return (
    <Panel className="p-5 sm:p-6 xl:p-[1.125rem]">
      <section aria-labelledby="supported-heading">
        <PanelHeader
          id="supported-heading"
          title="Continue your impact"
          action={<PanelLink href="/campaigns">View all</PanelLink>}
        />

        {campaigns.length === 0 ? (
          <EmptyState
            className="mt-5 xl:mt-3"
            title="You haven't supported a campaign yet."
            description="When a donation is confirmed, its campaign appears here with what you gave."
            action={{ label: 'Explore Campaigns', href: '/campaigns' }}
          />
        ) : (
          <>
            {/* ──────── Mobile Cards View (< md) matching Mockup 1 ──────── */}
            <div className="mt-4 space-y-4 md:hidden">
              {campaigns.map((campaign) => {
                const tone = categoryTone(campaign.category);
                return (
                  <div
                    key={campaign.campaignId}
                    className="card-interactive overflow-hidden rounded-2xl p-4"
                  >
                    {/* Campaign Cover with Heart Button top-right */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
                      <MediaFrame
                        media={campaign.cover}
                        aspect="landscape"
                        className="size-full rounded-2xl"
                        sizes="(min-width: 640px) 400px, 100vw"
                      />
                      <div className="absolute right-3 top-3 z-10">
                        <Link
                          href={`/campaigns/${campaign.slug}`}
                          aria-label={`Save ${campaign.title}`}
                          className="text-primary flex size-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition-transform active:scale-95 dark:bg-slate-900"
                        >
                          <Heart className="size-4.5 stroke-[2]" />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3.5 space-y-2.5">
                      {/* Category Badge */}
                      {campaign.category ? (
                        <div>
                          <span
                            className={cn(
                              'text-caption inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium',
                              tone.chip,
                            )}
                          >
                            <CategoryIcon category={campaign.category} className="size-3" />
                            {campaign.category}
                          </span>
                        </div>
                      ) : null}

                      {/* Campaign Title */}
                      <h3 className="font-display text-foreground text-base font-bold leading-snug">
                        <Link
                          href={`/campaigns/${campaign.slug}`}
                          className="hover:text-primary transition-colors"
                        >
                          {campaign.title}
                        </Link>
                      </h3>

                      {/* Progress & raised stats matching Mockup 1 */}
                      {(() => {
                        const percent =
                          campaign.fundraisingGoal && campaign.fundraisingGoal > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (campaign.amountRaised / campaign.fundraisingGoal) * 100,
                                ),
                              )
                            : // No goal, no percentage: an invented one would be a figure nobody counted.
                              null;
                        return (
                          <div className="space-y-1.5 pt-1">
                            {percent !== null ? (
                              <div className="flex items-center gap-2.5">
                                <div
                                  role="progressbar"
                                  aria-valuenow={percent}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  aria-label={`Funding progress for ${campaign.title}`}
                                  className="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F2F5] dark:bg-slate-800"
                                >
                                  <div
                                    className="bg-primary h-full rounded-full transition-all duration-300"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="font-display text-foreground text-xs font-bold tabular-nums">
                                  {percent}%
                                </span>
                              </div>
                            ) : null}
                            <p className="text-muted-foreground text-xs">
                              <span className="font-display text-foreground font-bold tabular-nums">
                                {formatCurrency(campaign.amountRaised)}
                              </span>{' '}
                              raised
                              {campaign.fundraisingGoal ? (
                                <>
                                  {' of '}
                                  <span className="tabular-nums">
                                    {formatCurrency(campaign.fundraisingGoal)}
                                  </span>
                                </>
                              ) : null}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Full-width Donate Button */}
                      <div className="pt-1.5">
                        <Link
                          href={`/campaigns/${campaign.slug}#give`}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring shadow-xs flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition-all active:scale-95"
                        >
                          <span>Donate</span>
                          <ArrowRight className="size-3.5 stroke-[2.2]" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ──────── Desktop / Tablet Rows (>= md) ──────── */}
            <ul className="divide-border/70 mt-3 hidden divide-y md:block xl:mt-1">
              {campaigns.map((campaign, index) => {
                const tone = categoryTone(campaign.category);
                return (
                  <li
                    key={campaign.campaignId}
                    className={cn(
                      'grid gap-x-4 gap-y-3 py-4 md:grid-cols-[8.5rem_minmax(0,1fr)_auto_auto_auto] md:items-center xl:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto_auto] xl:py-1.5',
                      fitRow(index),
                    )}
                  >
                    <div className="flex gap-4 md:contents">
                      <MediaFrame
                        media={campaign.cover}
                        aspect="landscape"
                        className="w-28 shrink-0 rounded-xl md:w-full xl:rounded-lg"
                        sizes="(min-width: 1280px) 72px, 136px"
                      />
                      <div className="min-w-0 md:flex md:flex-wrap md:items-center md:gap-x-3 md:gap-y-1">
                        <h3 className="text-body-sm min-w-0 font-semibold">
                          <Link
                            href={`/campaigns/${campaign.slug}`}
                            className="text-foreground focus-visible:outline-ring rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {campaign.title}
                          </Link>
                        </h3>
                        {campaign.category ? (
                          <span
                            className={cn(
                              'text-caption mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium md:mt-0',
                              tone.chip,
                            )}
                          >
                            <CategoryIcon category={campaign.category} className="size-3" />
                            {campaign.category}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-body-sm text-muted-foreground whitespace-nowrap">
                      {formatDayMonthYear(campaign.lastDonatedAt)}
                    </p>
                    <p
                      data-numeric=""
                      className="text-body-sm whitespace-nowrap font-semibold tabular-nums"
                    >
                      {formatCurrency(Number(campaign.contributed))}
                    </p>
                    <Link
                      href={`/campaigns/${campaign.slug}`}
                      aria-label={`View ${campaign.title}`}
                      className="border-cta-glow/70 text-primary hover:bg-(--cta-50) focus-visible:outline-ring inline-flex h-10 items-center justify-center gap-1.5 rounded-full border px-5 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 xl:h-9 xl:px-4"
                    >
                      View
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </Panel>
  );
}
