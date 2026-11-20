'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * A message that stays on the page while a condition holds (2026-11-19,
 * docs/ui-feedback.md): offline, maintenance, a campaign paused, a PAN
 * missing. Not for "it worked": that is a toast.
 *
 * Dismissible when `storageKey` is given; the dismissal is remembered in this
 * browser (and silently forgotten where storage is unavailable). A banner for
 * a condition the person must act on should not be dismissible.
 */

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

const TONE: Record<
  BannerTone,
  { icon: React.ComponentType<{ className?: string }>; box: string; icon_: string }
> = {
  info: { icon: Info, box: 'border-info/30 bg-info-subtle', icon_: 'text-info' },
  success: {
    icon: CheckCircle2,
    box: 'border-success/30 bg-success-subtle',
    icon_: 'text-success',
  },
  warning: {
    icon: TriangleAlert,
    box: 'border-warning/40 bg-warning-subtle',
    icon_: 'text-warning-foreground',
  },
  error: {
    icon: AlertCircle,
    box: 'border-destructive/30 bg-destructive-subtle',
    icon_: 'text-destructive',
  },
};

function remembered(key: string): boolean {
  try {
    return window.localStorage.getItem(`banner:${key}`) === 'dismissed';
  } catch {
    return false;
  }
}

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  children?: React.ReactNode;
  /** A link or button for the next step. */
  action?: React.ReactNode;
  /** Makes it dismissible, remembered under this key. */
  storageKey?: string;
  className?: string;
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  storageKey,
  className,
}: BannerProps) {
  const [hidden, setHidden] = React.useState(false);
  // Read after mount: storage does not exist on the server.
  React.useEffect(() => {
    if (storageKey && remembered(storageKey)) setHidden(true);
  }, [storageKey]);
  if (hidden) return null;

  const style = TONE[tone];
  const Icon = style.icon;
  const dismiss = () => {
    setHidden(true);
    try {
      if (storageKey) window.localStorage.setItem(`banner:${storageKey}`, 'dismissed');
    } catch {
      // Private mode or blocked storage: hidden for this visit only.
    }
  };

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('relative flex gap-3 rounded-xl border p-4', style.box, className)}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', style.icon_)} aria-hidden="true" />
      <div className={cn('min-w-0 flex-1 text-sm', storageKey && 'pr-8')}>
        <p className="text-foreground font-semibold">{title}</p>
        {children ? <div className="text-muted-foreground mt-0.5">{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {storageKey ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label={`Dismiss: ${title}`}
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 focus-visible:outline-ring touch-target absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full focus-visible:outline-2"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
