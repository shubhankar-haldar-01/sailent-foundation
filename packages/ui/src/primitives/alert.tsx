import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';

import { cn } from '../lib/cn';

const alertVariants = cva('relative flex gap-3 rounded-lg border p-4 text-body-sm', {
  variants: {
    variant: {
      info: 'border-info/25 bg-info-subtle text-foreground',
      success: 'border-success/25 bg-success-subtle text-foreground',
      warning: 'border-warning/30 bg-warning-subtle text-foreground',
      destructive: 'border-destructive/25 bg-destructive-subtle text-foreground',
    },
  },
  defaultVariants: { variant: 'info' },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** Icon accompanies colour so meaning is never carried by colour alone. */
  showIcon?: boolean;
}

export function Alert({
  className,
  variant = 'info',
  showIcon = true,
  children,
  ...props
}: AlertProps) {
  const Icon = icons[variant ?? 'info'];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {showIcon ? (
        <Icon
          className={cn(
            'mt-0.5 size-5 shrink-0',
            variant === 'destructive' && 'text-destructive',
            variant === 'success' && 'text-success',
            variant === 'warning' && 'text-warning',
            variant === 'info' && 'text-info',
          )}
          aria-hidden="true"
        />
      ) : null}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mb-1 font-semibold leading-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-muted-foreground', className)} {...props} />;
}
