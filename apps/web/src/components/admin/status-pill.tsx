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
    pillClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500',
  },
  active: {
    label: 'Active',
    pillClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500',
  },
  open: {
    label: 'Open',
    pillClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    dotClass: 'bg-emerald-500',
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
    pillClass:
      'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    dotClass: 'bg-blue-500',
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
    pillClass:
      'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    dotClass: 'bg-amber-500',
  },
  closed: {
    label: 'Closed',
    pillClass:
      'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    dotClass: 'bg-amber-500',
  },
  full: {
    label: 'Full',
    pillClass:
      'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    dotClass: 'bg-purple-500',
  },
  // Completed (Blue / Info)
  completed: {
    label: 'Completed',
    pillClass:
      'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    dotClass: 'bg-blue-500',
  },
  // Cancelled / Archived / Suspended (Rose / Red)
  cancelled: {
    label: 'Cancelled',
    pillClass:
      'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    dotClass: 'bg-rose-500',
  },
  archived: {
    label: 'Deleted',
    pillClass:
      'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    dotClass: 'bg-rose-500',
  },
  suspended: {
    label: 'Suspended',
    pillClass:
      'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    dotClass: 'bg-rose-500',
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
