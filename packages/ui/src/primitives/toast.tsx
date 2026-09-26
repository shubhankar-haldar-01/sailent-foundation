'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Toast.
 *
 * Transient only. Errors persist until dismissed; successes auto-dismiss.
 * Stacks to a maximum of three.
 *
 * Deliberately NOT used for payment outcomes — a donor who misses a five-second
 * toast has no way to recover the information, so payment results get a page
 * (docs/design-system.md §5).
 */

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: Omit<Toast, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (input: Omit<Toast, 'id'> & { id?: string }) => {
      const id = input.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next: Toast = { ...input, id };

      setToasts((current) => [...current, next].slice(-MAX_TOASTS));

      // Errors persist: the user must acknowledge them.
      if (input.variant !== 'error') {
        const duration = input.duration ?? DEFAULT_DURATION;
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }

      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return context;
}

const variantIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // Announced without stealing focus.
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'z-100 pointer-events-none fixed flex flex-col gap-2 p-4',
        'inset-x-0 bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
        'sm:inset-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-sm',
      )}
    >
      {toasts.map((item) => {
        const Icon = variantIcons[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === 'error' ? 'alert' : 'status'}
            className={cn(
              'border-border bg-surface pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                item.variant === 'error' && 'text-destructive',
                item.variant === 'success' && 'text-success',
                item.variant === 'warning' && 'text-warning',
                item.variant === 'info' && 'text-info',
              )}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-body-sm font-medium">{item.title}</p>
              {item.description ? (
                <p className="text-caption text-muted-foreground mt-0.5">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className={cn(
                'text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-md p-1 transition-colors',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
