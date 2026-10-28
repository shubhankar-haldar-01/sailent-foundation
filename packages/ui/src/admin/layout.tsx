import * as React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CircleDollarSign,
  FileCode2,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  History,
  Image,
  Layers,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  Receipt,
  Scale,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tag,
  Target,
  UserCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

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

function resolveTitleIcon(title: string): LucideIcon | null {
  const key = title.trim().toLowerCase();
  if (key === 'dashboard') return LayoutDashboard;
  if (key.includes('campaign')) return Megaphone;
  if (key.includes('program')) return Layers;
  if (key.includes('donation')) return CircleDollarSign;
  if (key.includes('donor')) return Heart;
  if (key.includes('volunteer')) return UserCheck;
  if (key.includes('event')) return Calendar;
  if (key.includes('product')) return Package;
  if (key.includes('storie') || key.includes('story')) return Sparkles;
  if (key.includes('blog') || key.includes('post') || key.includes('article')) return BookOpen;
  if (key.includes('faq')) return HelpCircle;
  if (key.includes('user')) return UserCog;
  if (key.includes('role')) return Shield;
  if (key.includes('team') || key.includes('staff')) return ShieldCheck;
  if (key.includes('categor')) return Tag;
  if (key.includes('impact')) return Target;
  if (key.includes('page')) return Globe;
  if (key.includes('media')) return Image;
  if (key.includes('document')) return FileText;
  if (key.includes('message')) return MessageSquare;
  if (key.includes('newsletter')) return Mail;
  if (key.includes('template')) return FileCode2;
  if (key.includes('notification')) return Bell;
  if (key.includes('log') || key.includes('audit')) return History;
  if (key.includes('setting')) return Sliders;
  if (key.includes('tax')) return Receipt;
  if (key.includes('reconcil')) return Scale;
  if (key.includes('report')) return BarChart3;
  if (key.includes('payment')) return AlertTriangle;
  return null;
}

function inferCountLabel(title: string, count: number): string {
  const singular = count === 1;
  const key = title.trim().toLowerCase();
  if (key.includes('campaign')) return singular ? 'campaign' : 'campaigns';
  if (key.includes('program')) return singular ? 'program' : 'programs';
  if (key.includes('donation')) return singular ? 'donation' : 'donations';
  if (key.includes('donor')) return singular ? 'donor' : 'donors';
  if (key.includes('volunteer')) return singular ? 'volunteer' : 'volunteers';
  if (key.includes('event')) return singular ? 'event' : 'events';
  if (key.includes('product')) return singular ? 'product' : 'products';
  if (key.includes('storie') || key.includes('story')) return singular ? 'story' : 'stories';
  if (key.includes('page')) return singular ? 'page' : 'pages';
  if (key.includes('faq')) return singular ? 'FAQ' : 'FAQs';
  if (key.includes('user')) return singular ? 'user' : 'users';
  if (key.includes('role')) return singular ? 'role' : 'roles';
  if (key.includes('media')) return singular ? 'item' : 'items';
  if (key.includes('document')) return singular ? 'document' : 'documents';
  if (key.includes('categor')) return singular ? 'category' : 'categories';
  if (key.includes('log') || key.includes('audit')) return singular ? 'entry' : 'entries';
  if (key.includes('message')) return singular ? 'message' : 'messages';
  if (key.includes('report')) return singular ? 'report' : 'reports';
  return '';
}

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Record count, shown beside the title in list views. */
  count?: number;
  /** Optional custom count label (defaults to inferred from title) e.g. "campaigns", "programs" */
  countLabel?: string;
  /** Custom icon or LucideIcon component to render in the modern squircle tile. Pass false to disable. */
  icon?:
    | React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
    | React.ReactNode
    | false
    | null;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  count,
  countLabel,
  icon,
  breadcrumb,
  actions,
  status,
  className,
}: PageHeaderProps) {
  let iconElement: React.ReactNode = null;
  if (icon !== false && icon !== null) {
    if (React.isValidElement(icon)) {
      iconElement = (
        <div className="border-primary/20 bg-primary/10 text-primary shadow-xs flex size-11 shrink-0 items-center justify-center rounded-2xl border sm:size-12">
          {icon}
        </div>
      );
    } else if (
      typeof icon === 'function' ||
      (typeof icon === 'object' && icon !== null && 'render' in icon)
    ) {
      const CustomIcon = icon as React.ComponentType<{
        className?: string;
        'aria-hidden'?: boolean | 'true' | 'false';
      }>;
      iconElement = (
        <div className="border-primary/20 bg-primary/10 text-primary shadow-xs flex size-11 shrink-0 items-center justify-center rounded-2xl border sm:size-12">
          <CustomIcon className="size-5 sm:size-6" aria-hidden="true" />
        </div>
      );
    } else {
      const ResolvedIcon = resolveTitleIcon(title);
      if (ResolvedIcon) {
        iconElement = (
          <div className="border-primary/20 bg-primary/10 text-primary shadow-xs flex size-11 shrink-0 items-center justify-center rounded-2xl border sm:size-12">
            <ResolvedIcon className="size-5 sm:size-6" aria-hidden="true" />
          </div>
        );
      }
    }
  }

  let countBadge: React.ReactNode = null;
  if (typeof count === 'number') {
    const label = countLabel !== undefined ? countLabel : inferCountLabel(title, count);
    countBadge = (
      <span
        data-numeric=""
        className="border-primary/20 bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      >
        <span className="bg-primary size-1.5 rounded-full" aria-hidden="true" />
        {count}
        {label ? ` ${label}` : ''}
      </span>
    );
  }

  return (
    <header className={cn('border-border/70 flex flex-col gap-4 border-b pb-6', className)}>
      {breadcrumb ? <div className="text-sm">{breadcrumb}</div> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 sm:items-center sm:gap-4">
          {iconElement}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
              {countBadge}
              {status}
            </div>
            {description ? (
              typeof description === 'string' ? (
                <p className="text-body-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                  {description}
                </p>
              ) : (
                description
              )
            ) : null}
          </div>
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
      <p data-numeric="" className="font-display text-h2 mt-2 font-bold tabular-nums">
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
