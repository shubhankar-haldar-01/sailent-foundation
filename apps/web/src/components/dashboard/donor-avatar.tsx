import { cn } from '@sailent/ui';

import { initialsOf } from './format';

/**
 * The donor's avatar: their initials on a disc.
 *
 * There is no profile photograph in the data (and none is collected), so the
 * design's portraits become initials — the same green disc the header badge
 * uses, so the person is the same person everywhere. Decorative: the name is
 * always written beside it.
 */
export function DonorAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-success text-success-foreground grid shrink-0 place-items-center rounded-full font-semibold',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
