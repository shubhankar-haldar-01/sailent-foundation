'use client';

import * as React from 'react';
import { ErrorState } from '@sailent/ui';

/**
 * Route error boundary.
 *
 * Shows a safe message and the digest — never the stack. The digest is the
 * correlation handle a user can quote to support, which is what makes an
 * incident traceable without leaking internals (docs/design-system.md §7).
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Wired to Sentry in Phase 2, with PII scrubbing configured before the
    // first deploy rather than after the first leak.
    console.error('Route error:', error.message);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-16">
      <ErrorState requestId={error.digest} onRetry={reset} className="w-full max-w-lg" />
    </div>
  );
}
