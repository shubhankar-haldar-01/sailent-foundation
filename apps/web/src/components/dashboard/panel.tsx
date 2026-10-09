import { cn } from '@sailent/ui';

/**
 * The dashboard's card: white, softly rounded, a thin border and a faint
 * shadow — one shape for every panel on the page, so the sidebar, the hero's
 * neighbours and the right-hand column all read as one system.
 */
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border/60 bg-surface text-surface-foreground rounded-2xl border shadow-[0_10px_30px_-24px_rgb(15_23_42/0.35)]',
        className,
      )}
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
