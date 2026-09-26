import * as React from 'react';
import { AlertCircle, Inbox, Loader2, Lock, SearchX } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from '../primitives/button';

/**
 * State patterns.
 *
 * Every data-bearing view defines all of these. Missing states are where
 * products feel unfinished (docs/design-system.md §7).
 */

// ---------------------------------------------------------------------------
// Empty
// ---------------------------------------------------------------------------

/**
 * Three genuinely different situations. Conflating them is a common failure:
 * showing "No campaigns yet" to someone whose filters excluded everything is
 * actively misleading.
 */
export type EmptyStateKind = 'no-content' | 'no-results' | 'no-access';

export interface EmptyStateProps {
  kind?: EmptyStateKind;
  title: string;
  description?: string;
  /** The action that creates the first record, for `no-content`. */
  action?: React.ReactNode;
  /** For `no-results`: clearing the filters that excluded everything. */
  onClearFilters?: () => void;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const emptyIcons: Record<EmptyStateKind, React.ComponentType<{ className?: string }>> = {
  'no-content': Inbox,
  'no-results': SearchX,
  'no-access': Lock,
};

export function EmptyState({
  kind = 'no-content',
  title,
  description,
  action,
  onClearFilters,
  className,
  icon,
}: EmptyStateProps) {
  const Icon = icon ?? emptyIcons[kind];

  return (
    <div
      className={cn(
        'border-border flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      <Icon className="text-muted-foreground size-8" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-body text-foreground font-medium">{title}</p>
        {description ? (
          <p className="text-body-sm text-muted-foreground mx-auto max-w-prose">{description}</p>
        ) : null}
      </div>
      {onClearFilters ? (
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /**
   * Correlation id. Shown so a user can quote it to support and it can be
   * traced through Sentry and the audit log. Never show a stack trace.
   */
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'This is on us, not you. Please try again — if it keeps happening, get in touch and quote the reference below.',
  requestId,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'border-destructive/25 bg-destructive-subtle flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-14 text-center',
        className,
      )}
    >
      <AlertCircle className="text-destructive size-8" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-body text-foreground font-medium">{title}</p>
        <p className="text-body-sm text-muted-foreground mx-auto max-w-prose">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
      {requestId ? (
        <p className="text-caption text-muted-foreground">
          Reference: <code className="font-mono">{requestId}</code>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export interface LoadingStateProps {
  /** Announced to assistive technology. */
  label?: string;
  className?: string;
}

/** Spinner — for actions under about a second. Use a skeleton for content. */
export function LoadingState({ label = 'Loading', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <Loader2 className="text-muted-foreground size-7 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
