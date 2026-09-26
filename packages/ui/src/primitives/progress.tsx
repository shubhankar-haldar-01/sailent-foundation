'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '../lib/cn';

export interface ProgressProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> {
  value: number;
  /** Required: an accessible name for the bar. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'primary' | 'success';
  /**
   * Classes for the FILL, when neither preset tone fits — the campaign cards
   * colour their bar by category.
   *
   * Given, it replaces the tone's background entirely. It is deliberately not
   * a colour prop: the caller passes utilities, so a gradient is as easy as a
   * flat fill and no new colour has to be invented in this file.
   *
   * The fill is a non-text graphic, so whatever is passed must clear 3:1
   * against the track it sits in.
   */
  indicatorClassName?: string;
}

/**
 * Progress bar.
 *
 * The visual fill is clamped to 100% so the bar cannot overflow its track, but
 * `aria-valuenow` reports the TRUE value — an over-subscribed campaign is told
 * honestly to assistive tech rather than being silently capped.
 *
 * No count-up animation. It draws attention to the number rather than to what
 * it means, and makes a real figure feel like a sales device.
 */
export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress(
  { className, value, label, size = 'md', tone = 'primary', indicatorClassName, ...props },
  ref,
) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' } as const;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'bg-muted relative w-full overflow-hidden rounded-full',
        heights[size],
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'duration-(--duration-slow) ease-(--ease-out-soft) h-full w-full flex-1 rounded-full transition-transform',
          indicatorClassName ?? (tone === 'success' ? 'bg-success' : 'bg-primary'),
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
