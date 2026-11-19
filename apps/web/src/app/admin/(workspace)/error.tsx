'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, ErrorState } from '@sailent/ui';

/**
 * Admin workspace error boundary.
 *
 * Catches unhandled errors within the admin workspace without crashing the
 * root application layout or navigation shell.
 */
export default function AdminWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Admin workspace error details:', {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  const isSessionError =
    error.message?.includes('session') ||
    error.message?.includes('expired') ||
    error.message?.includes('UNAUTHENTICATED') ||
    error.message?.includes('401');

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <ErrorState
        title={isSessionError ? 'Session Expired' : 'Something went wrong in the admin panel'}
        description={
          isSessionError
            ? 'Your administrator session has expired. Please sign in again to continue.'
            : error.message && !error.message.includes('Server Components render')
              ? error.message
              : 'An unexpected error occurred while loading this view. You can retry or return to the admin dashboard.'
        }
        requestId={error.digest}
        onRetry={reset}
        className="mx-auto w-full max-w-lg"
      />
      {error.message &&
      error.message !==
        'An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included in this error instance which may provide additional details about the nature of the error.' ? (
        <div className="border-destructive/20 bg-destructive/10 text-destructive mt-3 max-w-lg rounded-lg border p-3 text-left font-mono text-xs">
          <p className="font-semibold">
            {error.name}: {error.message}
          </p>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {isSessionError ? (
          <Button asChild variant="primary">
            <Link href="/admin/login">Sign in again</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost">
            <Link href="/admin">Return to dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
