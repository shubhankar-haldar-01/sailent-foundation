import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Skeleton. Dimensions must match the final layout exactly so nothing shifts
 * when content arrives — a skeleton that changes size on load is worse than none.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
