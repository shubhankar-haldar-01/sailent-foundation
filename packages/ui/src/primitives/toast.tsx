'use client';

import * as React from 'react';
import { AlertCircle, Check, CheckCircle2, Info, Loader2, TriangleAlert, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Toasts: the short confirmation that a quick action finished.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ONE API, CALLABLE FROM ANYWHERE (2026-11-19, docs/ui-feedback.md).
 *
 *   toast.success('Campaign saved')
 *   toast.error('Couldn’t save', { action: { label: 'Try again', onClick } })
 *   const id = toast.loading('Preparing export…'); toast.update(id, { type: 'success', title: 'Export ready' })
 *   toast.undo('Campaign archived', () => restore())
 *   toast.copied()
 *
 * A module-level store rather than a React context, so an event handler, a
 * hook or a plain function can raise one without threading a hook through.
 * `<Toaster />` (mounted once, by `ToastProvider`) renders the store.
 *
 * Timing: success and info 4s, warning and undo 6s, a copied pill 2s; errors
 * and loading toasts stay until closed or updated. Hovering or focusing a
 * toast pauses it. At most three show, newest on top. Esc or the X closes one.
 *
 * NOT FOR PAYMENT OUTCOMES. A donor who misses a four-second toast cannot get
 * the information back, so a payment's result is a page (design-system §5).
 * ══════════════════════════════════════════════════════════════════════════
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'undo' | 'copied';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  description?: string;
  action?: ToastAction;
  /** Milliseconds; overrides the type's default. Ignored for errors and loading. */
  duration?: number;
}

export interface ToastRecord {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before it closes itself, or null to stay until closed. */
  duration: number | null;
  /** Bumped on `update`, so the item restarts its timer. */
  version: number;
}

export const TOAST_DURATIONS: Record<ToastType, number | null> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  undo: 6000,
  copied: 2000,
  error: null,
  loading: null,
};

export const MAX_VISIBLE_TOASTS = 3;

// ── The store ────────────────────────────────────────────────────────────────

type Listener = (toasts: ToastRecord[]) => void;
let records: ToastRecord[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener(records);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Next.js inlines `process.env.NODE_ENV` at build; this package has no Node types.
declare const process: { env: { NODE_ENV?: string } };

/** Sentence case, no "successfully", no "!", no "Error:" (docs/ui-feedback.md). */
function checkWording(title: string) {
  if (process.env.NODE_ENV === 'production') return;
  if (/successfully|!|^error:/i.test(title)) {
    console.warn(
      `[toast] "${title}": keep it short and plain, with no "successfully", "!" or "Error:".`,
    );
  }
}

function add(type: ToastType, title: string, options: ToastOptions = {}): string {
  checkWording(title);
  const id = `toast-${++counter}`;
  const duration =
    type === 'error' || type === 'loading' ? null : (options.duration ?? TOAST_DURATIONS[type]);
  records = [
    {
      id,
      type,
      title,
      description: options.description,
      action: options.action,
      duration,
      version: 0,
    },
    ...records,
  ].slice(0, MAX_VISIBLE_TOASTS);
  emit();
  return id;
}

function dismiss(id?: string) {
  records = id ? records.filter((record) => record.id !== id) : [];
  emit();
}

function update(
  id: string,
  next: { type: Exclude<ToastType, 'loading'> | 'loading'; title: string } & ToastOptions,
) {
  checkWording(next.title);
  let found = false;
  records = records.map((record) => {
    if (record.id !== id) return record;
    found = true;
    return {
      ...record,
      type: next.type,
      title: next.title,
      description: next.description,
      action: next.action,
      duration:
        next.type === 'error' || next.type === 'loading'
          ? null
          : (next.duration ?? TOAST_DURATIONS[next.type]),
      version: record.version + 1,
    };
  });
  // A loading toast closed by hand before it finished: show the outcome anew.
  if (!found) {
    add(next.type, next.title, next);
    return;
  }
  emit();
}

export const toast = {
  success: (title: string, options?: ToastOptions) => add('success', title, options),
  error: (title: string, options?: ToastOptions) => add('error', title, options),
  warning: (title: string, options?: ToastOptions) => add('warning', title, options),
  info: (title: string, options?: ToastOptions) => add('info', title, options),
  /** Stays until `toast.update(id, …)` gives it an outcome. */
  loading: (title: string, options?: Omit<ToastOptions, 'duration'>) =>
    add('loading', title, options),
  update,
  /** A six-second window to take an action back. */
  undo: (title: string, onUndo: () => void, options?: Omit<ToastOptions, 'action'>) =>
    add('undo', title, { ...options, action: { label: 'Undo', onClick: onUndo } }),
  /** A small dark pill, two seconds. */
  copied: (title = 'Copied') => add('copied', title),
  dismiss,
};

/** For tests: start from an empty stack. */
export function resetToastsForTests() {
  records = [];
  counter = 0;
  emit();
}

// ── Rendering ────────────────────────────────────────────────────────────────

const ICONS: Record<
  Exclude<ToastType, 'copied'>,
  { icon: React.ComponentType<{ className?: string }>; circle: string; bar: string }
> = {
  success: { icon: CheckCircle2, circle: 'bg-success-subtle text-success', bar: 'bg-success' },
  info: { icon: Info, circle: 'bg-info-subtle text-info', bar: 'bg-info' },
  undo: { icon: Info, circle: 'bg-info-subtle text-info', bar: 'bg-info' },
  warning: { icon: TriangleAlert, circle: 'bg-warning-subtle text-warning', bar: 'bg-warning' },
  error: {
    icon: AlertCircle,
    circle: 'bg-destructive-subtle text-destructive',
    bar: 'bg-destructive',
  },
  loading: { icon: Loader2, circle: 'bg-muted text-muted-foreground', bar: 'bg-muted' },
};

function ToastItem({ record }: { record: ToastRecord }) {
  const [paused, setPaused] = React.useState(false);
  const remaining = React.useRef<number | null>(record.duration);
  const startedAt = React.useRef(0);

  // A new outcome (`update`) starts a fresh countdown.
  React.useEffect(() => {
    remaining.current = record.duration;
  }, [record.duration, record.version]);

  React.useEffect(() => {
    if (paused || remaining.current === null) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismiss(record.id), remaining.current);
    return () => {
      clearTimeout(timer);
      if (remaining.current !== null) {
        remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
      }
    };
  }, [paused, record.id, record.version]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      dismiss(record.id);
    }
  };
  const pause = {
    onMouseEnter: () => setPaused(true),
    onMouseLeave: () => setPaused(false),
    onFocus: () => setPaused(true),
    onBlur: (event: React.FocusEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
    },
  };

  if (record.type === 'copied') {
    return (
      <div
        role="status"
        className="bg-foreground text-background pointer-events-auto mx-auto flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium shadow-lg sm:ml-auto sm:mr-0"
      >
        <Check className="size-4" aria-hidden="true" />
        {record.title}
      </div>
    );
  }

  const style = ICONS[record.type];
  const Icon = style.icon;
  return (
    <div
      role={record.type === 'error' ? 'alert' : 'status'}
      aria-live={record.type === 'error' ? 'assertive' : 'polite'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      {...pause}
      className="border-border bg-surface pointer-events-auto relative w-full overflow-hidden rounded-xl border shadow-lg"
    >
      <div className="flex items-start gap-3 p-3.5 pr-11">
        <span
          className={cn('grid size-8 shrink-0 place-items-center rounded-full', style.circle)}
          aria-hidden="true"
        >
          <Icon
            className={cn(
              'size-4',
              record.type === 'loading' && 'animate-spin motion-reduce:animate-none',
            )}
          />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-foreground text-sm font-semibold leading-snug">{record.title}</p>
          {record.description ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm leading-snug">
              {record.description}
            </p>
          ) : null}
          {record.action ? (
            <button
              type="button"
              onClick={() => {
                record.action!.onClick();
                dismiss(record.id);
              }}
              className="text-info-action focus-visible:outline-info-action touch-target relative -ml-1 mt-1.5 inline-flex min-h-8 items-center rounded-md px-1 text-sm font-semibold hover:underline focus-visible:outline-2"
            >
              {record.action.label}
            </button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => dismiss(record.id)}
        aria-label="Close notification"
        className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-ring touch-target absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full focus-visible:outline-2"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
      {record.duration !== null ? (
        <span
          key={record.version}
          aria-hidden="true"
          className={cn(
            'absolute bottom-0 left-0 h-0.5 w-full origin-left motion-reduce:opacity-0',
            style.bar,
          )}
          style={{
            animation: `sailent-toast-countdown ${record.duration}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      ) : null}
    </div>
  );
}

/** Renders the toast stack. Mounted once, by `ToastProvider`. */
export function Toaster() {
  const [items, setItems] = React.useState<ToastRecord[]>(records);
  React.useEffect(() => subscribe(setItems), []);

  return (
    <section
      aria-label="Notifications"
      className={cn(
        'z-(--z-toast) pointer-events-none fixed flex flex-col gap-2',
        'inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]',
        'sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[380px]',
      )}
    >
      <style>{`@keyframes sailent-toast-countdown { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
      {items.map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
    </section>
  );
}

/** Renders its children and the toast stack. Kept as the app's entry point. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

/** The same API as `toast`, for code that prefers a hook. */
export function useToast() {
  return toast;
}
