'use client';

import { useEffect } from 'react';
import { CircleAlert } from 'lucide-react';

import { Button } from '@sailent/ui';

/**
 * A dashboard page that could not load — inside the account shell, so the
 * navigation and Logout stay, with a plain message and a way to try again.
 * The error itself is logged, never shown: a donor is not helped by a stack
 * trace, and an API message may name things they should not see.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] page failed to render:', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="border-border/60 bg-surface rounded-2xl border px-6 py-14 text-center shadow-[0_10px_30px_-24px_rgb(15_23_42/0.35)]"
    >
      <span className="bg-destructive-subtle text-destructive mx-auto grid size-12 place-items-center rounded-full">
        <CircleAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="font-display text-foreground mt-4 text-[1.375rem] font-bold">
        Something went wrong
      </h1>
      <p className="text-body-sm text-muted-foreground mx-auto mt-2 max-w-sm">
        We couldn&rsquo;t load this information right now.
      </p>
      <Button type="button" onClick={reset} className="mt-6 h-11 rounded-full px-6">
        Try Again
      </Button>
    </div>
  );
}
