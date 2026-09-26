import { cn } from '../lib/cn';
import { formatCurrency, percentOf } from '../lib/format';
import { Progress } from '../primitives/progress';

export interface CampaignProgressProps {
  /** Paise. */
  raised: number;
  /** Paise. */
  goal: number;
  donorCount?: number;
  daysLeft?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Campaign progress.
 *
 * Shows the percentage AND both absolute figures. A percentage alone hides
 * whether the goal is ₹50,000 or ₹50,00,000, which is the difference between
 * a donation that matters and one that does not.
 *
 * The donor count is suppressed below 5 — "3 supporters" on a new campaign
 * reads as failure and depresses the very conversion it is meant to encourage.
 */
export function CampaignProgress({
  raised,
  goal,
  donorCount,
  daysLeft,
  size = 'md',
  className,
}: CampaignProgressProps) {
  const percent = percentOf(raised, goal);
  const reached = raised >= goal;
  const showDonors = typeof donorCount === 'number' && donorCount >= 5;

  return (
    <div className={cn('space-y-2', className)}>
      <Progress
        value={percent}
        size={size}
        tone={reached ? 'success' : 'primary'}
        label={`${percent}% of the ${formatCurrency(goal)} goal raised`}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-body-sm">
          <span data-numeric="" className="text-foreground font-semibold">
            {formatCurrency(raised)}
          </span>
          <span className="text-muted-foreground"> raised of {formatCurrency(goal)}</span>
        </p>
        <span data-numeric="" className="text-body-sm text-muted-foreground font-medium">
          {percent}%
        </span>
      </div>
      {(showDonors || typeof daysLeft === 'number') && (
        <p className="text-caption text-muted-foreground flex flex-wrap items-center gap-x-2">
          {showDonors ? <span data-numeric="">{donorCount} supporters</span> : null}
          {showDonors && typeof daysLeft === 'number' ? <span aria-hidden="true">·</span> : null}
          {/* Rendered only when there is a REAL end date. */}
          {typeof daysLeft === 'number' ? (
            <span data-numeric="">{daysLeft === 0 ? 'Final day' : `${daysLeft} days left`}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}
