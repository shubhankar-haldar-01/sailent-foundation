import * as React from 'react';

import { cn } from '../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'standard' | 'elevated' | 'interactive' | 'featured';
  interactive?: boolean;
}

/**
 * Card — a surface container, border-first (visual polish Phase 3,
 * 2026-11-21):
 *   • flat / standard: a hairline border, no shadow
 *   • interactive: the same at rest; lifts 2px with a soft shadow on hover —
 *     only for cards that ARE a link or button
 *   • featured: a stronger border, still no shadow
 *   • elevated: a shadow, for overlays and floating panels only
 * Never nest a card inside a card.
 */
export function Card({ className, variant = 'standard', interactive, ...props }: CardProps) {
  const effectiveVariant = interactive ? 'interactive' : variant;
  const variantClass = {
    flat: 'card-flat',
    standard: 'card-standard',
    elevated: 'card-elevated',
    interactive: 'card-interactive',
    featured: 'card-featured',
  }[effectiveVariant];

  return (
    <div
      className={cn('text-surface-foreground rounded-2xl', variantClass, className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

export function CardTitle({
  className,
  as: Comp = 'h3',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: 'h2' | 'h3' | 'h4' }) {
  return <Comp className={cn('text-h4 font-semibold leading-tight', className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-body-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 p-5 pt-0', className)} {...props} />;
}
