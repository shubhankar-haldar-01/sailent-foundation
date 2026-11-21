import { cn } from '@sailent/ui';

/**
 * A publication or entity lifecycle status, shown as a modern labelled pill
 * with an accessible tone dot indicator.
 *
 * Colour never carries the meaning alone — the status word is always present,
 * ensuring high accessibility across color-vision deficiencies.
 */
interface StatusConfig {
  label?: string;
  pillClass: string;
  dotClass: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  // Live / Published / Active / Open (Emerald)
  published: {
    label: 'Published',
    pillClass: 'bg-success-subtle text-success border-success/80',
    dotClass: 'bg-success',
  },
  active: {
    label: 'Active',
    pillClass: 'bg-success-subtle text-success border-success/80',
    dotClass: 'bg-success',
  },
  open: {
    label: 'Open',
    pillClass: 'bg-success-subtle text-success border-success/80',
    dotClass: 'bg-success',
  },
  // Draft / Pending / Muted
  draft: {
    label: 'Draft',
    pillClass:
      'bg-muted/70 text-muted-foreground border-border/80 dark:bg-muted/40 dark:border-border/60',
    dotClass: 'bg-muted-foreground/60',
  },
  pending: {
    label: 'Pending',
    pillClass:
      'bg-muted/70 text-muted-foreground border-border/80 dark:bg-muted/40 dark:border-border/60',
    dotClass: 'bg-muted-foreground/60',
  },
  unread: {
    label: 'Unread',
    pillClass: 'bg-info-subtle text-info border-info/80',
    dotClass: 'bg-info',
  },
  read: {
    label: 'Read',
    pillClass:
      'bg-muted/70 text-muted-foreground border-border/80 dark:bg-muted/40 dark:border-border/60',
    dotClass: 'bg-muted-foreground/60',
  },
  // Paused / Closed / Full (Amber / Purple)
  paused: {
    label: 'Paused',
    pillClass: 'bg-warning-subtle text-warning-foreground border-warning/80',
    dotClass: 'bg-warning',
  },
  closed: {
    label: 'Closed',
    pillClass: 'bg-warning-subtle text-warning-foreground border-warning/80',
    dotClass: 'bg-warning',
  },
  full: {
    label: 'Full',
    pillClass: 'bg-accent text-primary border-primary/80',
    dotClass: 'bg-primary',
  },
  // Completed (Blue / Info)
  completed: {
    label: 'Completed',
    pillClass: 'bg-info-subtle text-info border-info/80',
    dotClass: 'bg-info',
  },
  // Cancelled / Archived / Suspended (Rose / Red)
  cancelled: {
    label: 'Cancelled',
    pillClass: 'bg-destructive-subtle text-destructive border-destructive/80',
    dotClass: 'bg-destructive',
  },
  archived: {
    label: 'Deleted',
    pillClass: 'bg-destructive-subtle text-destructive border-destructive/80',
    dotClass: 'bg-destructive',
  },
  suspended: {
    label: 'Suspended',
    pillClass: 'bg-destructive-subtle text-destructive border-destructive/80',
    dotClass: 'bg-destructive',
  },
};

export function StatusPill({
  status,
  label: customLabel,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const key = status?.toLowerCase() ?? '';
  const config = STATUS_CONFIG[key];
  const displayLabel = customLabel ?? config?.label ?? (status === 'archived' ? 'Deleted' : status);

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium capitalize tracking-tight transition-colors',
        config?.pillClass ?? 'border-border/80 bg-muted/60 text-muted-foreground',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          config?.dotClass ?? 'bg-muted-foreground/60',
        )}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </span>
  );
}
