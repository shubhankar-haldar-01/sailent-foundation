import { Heart } from 'lucide-react';

import { formatCurrency } from '@sailent/ui';
import type { DonorImpact } from '@/lib/donor/api';

/**
 * Impact figures (adapted from competitor reference).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * EVERY FIGURE IS SUMMED FROM THIS DONOR'S OWN CONFIRMED DONATIONS (decision A14).
 * ══════════════════════════════════════════════════════════════════════════
 */
export function StatCards({ impact }: { impact: DonorImpact }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {/* Total Donations Card */}
      <li className="card-elevated p-4.5 flex items-center gap-4 rounded-2xl sm:p-5">
        <div
          aria-hidden="true"
          className="bg-primary/10 text-primary flex size-14 shrink-0 items-center justify-center rounded-2xl"
        >
          <span className="font-display flex size-8 items-center justify-center rounded-full border-2 border-current text-sm font-bold">
            ₹
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium sm:text-sm">Total Donations</p>
          <p
            data-numeric=""
            className="font-display text-foreground text-2xl font-bold tabular-nums sm:text-[1.75rem]"
          >
            {formatCurrency(impact.totalGiven)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {impact.donationCount > 0
              ? `${impact.donationCount} Successful ${impact.donationCount === 1 ? 'Payment' : 'Payments'}`
              : 'Successful Payments'}
          </p>
        </div>
      </li>

      {/* Campaigns Supported Card */}
      <li className="card-elevated p-4.5 flex items-center gap-4 rounded-2xl sm:p-5">
        <div
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        >
          <Heart className="size-6 fill-current stroke-none" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium sm:text-sm">
            Campaigns Supported
          </p>
          <p
            data-numeric=""
            className="font-display text-foreground text-2xl font-bold tabular-nums sm:text-[1.75rem]"
          >
            {String(impact.campaignsSupported || 0)}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">Distinct Campaigns</p>
        </div>
      </li>
    </ul>
  );
}
