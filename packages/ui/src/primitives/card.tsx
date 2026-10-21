import * as React from 'react';

import { cn } from '../lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'standard' | 'elevated' | 'interactive' | 'featured';
  interactive?: boolean;
}

/**
 * Card — foundational surface container with elevation variants:
 *   • flat: visually quiet, no shadow
 *   • standard: default subtle shadow and delicate border
 *   • elevated: slightly deeper shadow for summary/featured containers
 *   • interactive: card shadow with restrained hover elevation (-2.5px)
 *   • featured: subtle warm ambient glow for genuinely featured content
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
