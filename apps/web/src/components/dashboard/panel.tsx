import { cn } from '@sailent/ui';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'standard' | 'elevated' | 'interactive' | 'featured';
}

/**
 * The dashboard's card: integrated into the global elevation system with
 * subtle warm border, soft low-opacity layered shadows, and rounded-2xl geometry.
 */
export function Panel({ className, variant = 'standard', ...props }: PanelProps) {
  const variantClass = {
    flat: 'card-flat',
    standard: 'card-standard',
    elevated: 'card-elevated',
    interactive: 'card-interactive',
    featured: 'card-featured',
  }[variant];

  return (
    <div
      className={cn('text-surface-foreground rounded-2xl', variantClass, className)}
      {...props}
    />
  );
}

/** A panel's title row: heading on the left, an optional link on the right. */
export function PanelHeader({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2
        id={id}
        className="font-display text-foreground text-[1.25rem] font-bold tracking-[-0.01em]"
      >
        {title}
      </h2>
      {action}
    </div>
  );
}
