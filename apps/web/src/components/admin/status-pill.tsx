import { cn } from '@sailent/ui';

/**
 * A publication status, shown as a labelled pill.
 *
 * Colour never carries the meaning alone — the status word is always present,
 * because roughly one in twelve men cannot reliably distinguish the red and
 * green that would otherwise separate "paused" from "active".
 */
const TONES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-info-subtle text-info',
  active: 'bg-success-subtle text-success',
  paused: 'bg-warning-subtle text-warning-foreground',
  completed: 'bg-accent text-accent-foreground',
  archived: 'bg-muted text-muted-foreground line-through',
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-full px-2.5 py-0.5 font-medium capitalize',
        TONES[status] ?? 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {status}
    </span>
  );
}
