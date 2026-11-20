'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, ErrorState } from '@sailent/ui';

/**
 * Admin workspace error boundary.
 *
 * Catches unhandled errors within the admin workspace without crashing the
 * root application layout or navigation shell.
 *
 * NEVER THE RAW ERROR ON SCREEN (docs/ui-feedback.md §4): no message, name or
 * stack, which can carry a server or database detail. The screen says what
 * happened and what to do, with the digest as a reference to quote; the detail
 * goes to the browser console for whoever is debugging.
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
        title={isSessionError ? 'Your session has ended' : 'This page didn’t load'}
        description={
          isSessionError
            ? 'Sign in again to carry on. Nothing you saved has been lost.'
            : 'Try again. If it keeps happening, tell the technical team and quote the reference below.'
        }
        requestId={error.digest}
        onRetry={isSessionError ? undefined : reset}
        className="mx-auto w-full max-w-lg"
      />
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
