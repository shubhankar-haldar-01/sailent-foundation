'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button, Card } from '@sailent/ui';

import {
  confirmNewsletter,
  unsubscribeNewsletter,
  type PublicFormState,
} from '@/lib/communications/actions';

/**
 * The button behind a newsletter email link (Phase 13).
 *
 * The link opens this page; nothing happens until the person presses the
 * button. Mail scanners follow links on their own, and a GET that confirmed or
 * unsubscribed would let one do either without anybody asking.
 */
export function NewsletterTokenForm({
  mode,
  token,
}: {
  mode: 'confirm' | 'unsubscribe';
  token: string;
}) {
  const [state, action, pending] = React.useActionState<PublicFormState, FormData>(
    mode === 'confirm' ? confirmNewsletter : unsubscribeNewsletter,
    {},
  );

  if (state.ok) {
    return (
      <Card className="border-success/30 bg-success-subtle p-6">
        <p role="status" className="text-body-sm flex items-start gap-2">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {mode === 'confirm'
              ? 'You are subscribed. Thank you — keep the email we sent: its unsubscribe link works at any time.'
              : 'You are unsubscribed, and will not receive the newsletter.'}
          </span>
        </p>
        <Link href="/" className="text-body-sm text-primary mt-4 inline-block underline">
          Back to the home page
        </Link>
      </Card>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="text-body-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {mode === 'confirm' ? 'Confirm my subscription' : 'Unsubscribe'}
      </Button>
    </form>
  );
}
