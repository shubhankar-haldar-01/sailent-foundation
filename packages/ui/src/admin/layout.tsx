import * as React from 'react';

import { cn } from '../lib/cn';
import { Button } from '../primitives/button';

/**
 * Admin layout primitives.
 *
 * Same tokens as the public site, different density: 16–24px rhythm against the
 * public 96–128px, a compressed type scale, and cool neutrals via the
 * `data-surface="admin"` attribute set on the layout root. That single attribute
 * is the whole difference in temperature (docs/design-system.md §1).
 */

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Record count, shown beside the title in list views. */
  count?: number;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  count,
  breadcrumb,
  actions,
  status,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('border-border flex flex-col gap-3 border-b pb-5', className)}>
      {breadcrumb}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-h2 font-semibold tracking-tight">{title}</h1>
            {typeof count === 'number' ? (
              <span
                data-numeric=""
                className="bg-muted text-caption text-muted-foreground rounded-md px-2 py-0.5 font-medium"
              >
                {count}
              </span>
            ) : null}
            {status}
          </div>
          {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

export interface StatsCardProps {
  label: string;
  value: string | number;
  /** Change against a comparison period. Shown only when supplied. */
  delta?: { value: number; label: string };
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;
  className?: string;
}

export function StatsCard({
  label,
  value,
  delta,
  icon: Icon,
  href,
  LinkComponent,
  className,
}: StatsCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-muted-foreground">{label}</p>
        {Icon ? <Icon className="text-muted-foreground size-4" aria-hidden="true" /> : null}
      </div>
      <p data-numeric="" className="text-h2 mt-2 font-semibold tabular-nums">
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            'text-caption mt-1',
            delta.value > 0
              ? 'text-success'
              : delta.value < 0
                ? 'text-destructive'
                : 'text-muted-foreground',
          )}
        >
          <span data-numeric="">
            {delta.value > 0 ? '+' : ''}
            {delta.value}%
          </span>{' '}
          <span className="text-muted-foreground">{delta.label}</span>
        </p>
      ) : null}
    </>
  );

  const classes = cn(
    'rounded-md border border-border bg-surface p-4',
    href && 'transition-colors hover:border-border-strong',
    className,
  );

  if (href && LinkComponent) {
    const Link = LinkComponent;
    return (
      <Link
        href={href}
        className={cn(
          classes,
          'focus-visible:outline-ring block focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}

// ---------------------------------------------------------------------------

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('border-border grid gap-5 border-b py-6 md:grid-cols-3 md:gap-8', className)}
    >
      <div className="space-y-1 md:col-span-1">
        <h2 className="text-body font-semibold">{title}</h2>
        {description ? <p className="text-body-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4 md:col-span-2">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function DetailPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside className={cn('border-border bg-surface rounded-md border p-4', className)}>
      {title ? <h2 className="text-body-sm mb-3 font-semibold">{title}</h2> : null}
      <dl className="space-y-3">{children}</dl>
    </aside>
  );
}

export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-caption text-right font-medium">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target?: string;
  timestamp: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * ActivityTimeline. Rendered from the audit log, filtered to what the viewer
 * may see. Present on every significant entity so "who changed this and when"
 * is always answerable (decision A10).
 */
export function ActivityTimeline({
  items,
  className,
}: {
  items: ActivityItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn('text-body-sm text-muted-foreground', className)}>
        No activity recorded yet.
      </p>
    );
  }

  return (
    <ol className={cn('space-y-4', className)}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
              {Icon ? <Icon className="text-muted-foreground size-3.5" aria-hidden="true" /> : null}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-body-sm">
                <span className="font-medium">{item.actor}</span> {item.action}
                {item.target ? <span className="font-medium"> {item.target}</span> : null}
              </p>
              <time className="text-caption text-muted-foreground">{item.timestamp}</time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------

export function ChartContainer({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border-border bg-surface rounded-md border', className)}>
      <header className="border-border flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-body font-semibold">{title}</h2>
          {description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ConfirmDialogFooter({
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isSubmitting = false,
  disabled = false,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isSubmitting?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
        {cancelLabel}
      </Button>
      <Button
        variant={destructive ? 'destructive' : 'primary'}
        onClick={onConfirm}
        isLoading={isSubmitting}
        disabled={disabled}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
