import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * Badge. One size: 24px high, a pill (tags are the one place pills stay,
 * owner 2026-11-21), 12px medium text, 12px icons.
 *
 * Always icon + text where it conveys status — colour never carries meaning
 * alone (docs/design-system.md §3). `brand` is for tags and selections; a
 * success state is `success`, which is teal and carries its icon.
 */
const badgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        accent: 'bg-accent text-accent-foreground',
        brand: 'bg-accent text-accent-foreground',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning-foreground',
        destructive: 'bg-destructive-subtle text-destructive',
        info: 'bg-info-subtle text-info',
        outline: 'border border-border-strong text-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
