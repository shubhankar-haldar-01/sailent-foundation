import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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
          title="Campaigns You've Supported"
          action={<PanelLink href="/campaigns">View All Campaigns</PanelLink>}
        />

        {campaigns.length === 0 ? (
          <EmptyState
            className="mt-5 xl:mt-3"
            title="You haven't supported a campaign yet."
            description="When a donation is confirmed, its campaign appears here with what you gave."
            action={{ label: 'Explore Campaigns', href: '/campaigns' }}
          />
        ) : (
          <ul className="divide-border/70 mt-3 divide-y xl:mt-1">
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
                      {/* Date and amount, phone only — the grid gives them columns from `md`. */}
                      <p className="text-caption text-muted-foreground mt-2 md:hidden">
                        {formatDayMonthYear(campaign.lastDonatedAt)} ·{' '}
                        <span
                          data-numeric=""
                          className="text-foreground font-semibold tabular-nums"
                        >
                          {formatCurrency(Number(campaign.contributed))}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="text-body-sm text-muted-foreground hidden whitespace-nowrap md:block">
                    {formatDayMonthYear(campaign.lastDonatedAt)}
                  </p>
                  <p
                    data-numeric=""
                    className="text-body-sm hidden whitespace-nowrap font-semibold tabular-nums md:block"
                  >
                    {formatCurrency(Number(campaign.contributed))}
                  </p>
                  <Link
                    href={`/campaigns/${campaign.slug}`}
                    aria-label={`View ${campaign.title}`}
                    className="border-cta-glow/70 text-primary hover:bg-(--cta-50) focus-visible:outline-ring inline-flex h-11 items-center justify-center gap-1.5 rounded-full border px-5 text-[0.9375rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:h-10 xl:h-9 xl:px-4"
                  >
                    View
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Panel>
  );
}
