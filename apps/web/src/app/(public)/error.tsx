'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, ErrorState } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';

/**
 * Public-section error boundary.
 *
 * Shows a safe message plus the digest — never a stack trace. The digest is the
 * handle a visitor can quote to us, which is what makes an incident traceable
 * without leaking internals.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Sentry wiring lands with the monitoring work; PII scrubbing is configured
    // before that first deploy rather than after the first leak.
    console.error('Public route error:', error.message);
  }, [error]);

  return (
    <Section>
      <PageShell>
        <ErrorState
          title="Something went wrong on this page"
          description="This is on us, not you. Try again — if it keeps happening, get in touch and quote the reference below."
          requestId={error.digest}
          onRetry={reset}
          className="mx-auto max-w-2xl"
        />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/">Go to the homepage</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </PageShell>
    </Section>
  );
}
