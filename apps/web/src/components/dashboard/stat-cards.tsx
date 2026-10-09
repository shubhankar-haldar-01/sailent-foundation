import { Coins, Heart, Package, type LucideIcon } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import type { DonorImpact } from '@/lib/donor/api';

import { Panel } from './panel';

/**
 * The three impact figures (design, 2026-10-08).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE IS SUMMED FROM THIS DONOR'S OWN CONFIRMED DONATIONS (decision
 * A14). The design's third card, "Lives Impacted 25+", has no column behind
 * it — nothing in the database counts lives — so the third card is the one
 * thing that IS counted: the items the donor's gifts bought. "12% from last
 * month" is likewise not computed from anything, so the supporting line says
 * how many donations the total covers instead.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function StatCards({ impact }: { impact: DonorImpact }) {
  const items = impact.itemsProvided.reduce((sum, item) => sum + item.quantity, 0);
  const kinds = impact.itemsProvided.length;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-3">
      <StatCard
        icon={Coins}
        tone="green"
        label="Total Donations"
        value={formatCurrency(impact.totalGiven)}
        detail={
          impact.donationCount > 0
            ? `Across ${impact.donationCount} ${impact.donationCount === 1 ? 'donation' : 'donations'}`
            : 'No donations yet'
        }
      />
      <StatCard
        icon={Heart}
        tone="coral"
        label="Campaigns Supported"
        value={String(impact.campaignsSupported)}
        detail={impact.campaignsSupported === 1 ? 'Distinct campaign' : 'Distinct campaigns'}
      />
      <StatCard
        icon={Package}
        tone="blue"
        label="Items Provided"
        value={String(items)}
        detail={
          kinds > 0 ? `${kinds} ${kinds === 1 ? 'kind' : 'kinds'} of item` : 'Through your support'
        }
        className="sm:col-span-2 xl:col-span-1"
      />
    </ul>
  );
}

const TONES = {
  green: 'bg-success-subtle text-success',
  coral: 'bg-(--cta-50) text-cta-glow dark:bg-primary/15',
  blue: 'bg-wash-blue text-wash-blue-ink',
} as const;

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  className,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <li className={cn('flex', className)}>
      <Panel className="flex w-full items-center gap-3.5 p-4 sm:gap-4 sm:p-5 xl:gap-3 xl:px-3.5 xl:py-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-full sm:size-14 xl:size-10',
            TONES[tone],
          )}
        >
          <Icon className="size-5 sm:size-6 xl:size-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground sm:text-body-sm text-[0.8125rem] xl:text-[0.8125rem] xl:leading-5">
            {label}
          </p>
          <p
            data-numeric=""
            className="font-display text-foreground mt-0.5 break-words text-[1.5rem] font-bold tabular-nums leading-tight sm:text-[1.625rem] xl:text-[1.375rem]"
          >
            {value}
          </p>
          <p className="text-caption text-muted-foreground mt-1 xl:mt-0.5 xl:leading-4">{detail}</p>
        </div>
      </Panel>
    </li>
  );
}
