'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw } from 'lucide-react';

import { Alert, Button, Card, Separator, formatCurrency } from '@sailent/ui';

interface DonationView {
  reference: string;
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'cancelled';
  amount: number;
  donationType: string;
  campaignSlug: string | null;
  campaignTitle: string | null;
  donorName: string | null;
  completedAt: string | null;
  items: {
    itemType: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

interface ReceiptView {
  receiptNumber: string;
  issuedAt: string;
}

/**
 * What actually happened to a donation.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT POLLS, AND IT STOPS POLLING.
 *
 * A donation is `pending` until the server has verified the payment — usually
 * a second or two, occasionally longer if the browser's verification failed and
 * the webhook is carrying the load. So this asks again, backing off, for about
 * ninety seconds.
 *
 * Then it stops and says so, rather than spinning forever. An indefinite
 * spinner is the worst of the three outcomes to show: it gives no information
 * and no action, and the donor's reasonable response is to pay again. The
 * timeout message says explicitly that the payment may still be going through
 * and asks them NOT to retry, because at that point a duplicate is the likelier
 * error than a lost payment.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function DonationStatus({ reference }: { reference: string }) {
  const [donation, setDonation] = React.useState<DonationView | null>(null);
  const [receipt, setReceipt] = React.useState<ReceiptView | null>(null);
  const [phase, setPhase] = React.useState<
    'loading' | 'settled' | 'waiting' | 'timeout' | 'missing'
  >('loading');

  React.useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    // ~90 seconds of backoff: brisk at first, because most donations settle
    // almost immediately, then slower so a long wait is not a request storm.
    const delays = [
      1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10_000, 12_000, 15_000, 20_000,
    ];

    async function poll() {
      try {
        const response = await fetch(`/api/bff/donations/${reference}`, { cache: 'no-store' });
        if (cancelled) return;

        if (response.status === 404) {
          setPhase('missing');
          return;
        }

        const payload = (await response.json()) as { success: boolean; data?: DonationView };
        if (!payload.success || !payload.data) throw new Error('unreadable');

        setDonation(payload.data);

        const settled = payload.data.status !== 'pending' && payload.data.status !== 'processing';
        if (settled) {
          setPhase('settled');
          if (payload.data.status === 'successful') void loadReceipt();
          return;
        }

        if (attempt >= delays.length) {
          setPhase('timeout');
          return;
        }

        setPhase('waiting');
        const delay = delays[attempt] ?? 20_000;
        attempt += 1;
        window.setTimeout(() => void poll(), delay);
      } catch {
        if (cancelled) return;
        if (attempt >= delays.length) {
          setPhase('timeout');
          return;
        }
        const delay = delays[attempt] ?? 20_000;
        attempt += 1;
        window.setTimeout(() => void poll(), delay);
      }
    }

    async function loadReceipt() {
      try {
        const response = await fetch(`/api/bff/donations/${reference}/receipt`, {
          cache: 'no-store',
        });
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as { success: boolean; data?: ReceiptView };
        if (payload.success && payload.data) setReceipt(payload.data);
      } catch {
        // A missing receipt is not worth an error on a success page — the
        // donation is recorded either way and the email carries the number.
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [reference]);

  if (phase === 'loading') {
    return (
      <Card className="p-10 text-center">
        <Loader2 className="text-muted-foreground mx-auto size-6 animate-spin" aria-hidden="true" />
        <p className="text-body-sm text-muted-foreground mt-4">Looking up your donation…</p>
      </Card>
    );
  }

  if (phase === 'missing') {
    return (
      <Card className="p-10 text-center">
        <AlertTriangle className="text-warning-foreground mx-auto size-7" aria-hidden="true" />
        <h1 className="text-h2 mt-4 font-bold">We cannot find that donation</h1>
        <p className="text-body text-muted-foreground mx-auto mt-3 max-w-prose">
          Check the reference in your confirmation email. If you have just paid and this keeps
          happening, contact us with the reference before trying again — we would rather find your
          payment than take a second one.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/contact">Contact us</Link>
        </Button>
      </Card>
    );
  }

  const status = donation?.status;

  if (phase === 'settled' && status === 'successful') {
    return (
      <div className="space-y-6">
        <Card className="border-success/30 bg-success-subtle p-8 text-center">
          <CheckCircle2 className="text-success mx-auto size-9" aria-hidden="true" />
          <h1 className="text-h2 mt-4 font-bold">
            Thank you{donation?.donorName ? `, ${donation.donorName}` : ''}
          </h1>
          <p className="text-body text-muted-foreground mt-3">
            Your donation to <strong>{donation?.campaignTitle}</strong> has been received.
          </p>
          <p data-numeric="" className="font-display text-display mt-4 font-bold tabular-nums">
            {formatCurrency(donation!.amount)}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-h4 font-semibold">What you funded</h2>
          <ul className="mt-4 space-y-2">
            {donation!.items.map((item, index) => (
              <li
                key={`${item.itemName}-${index}`}
                className="flex items-baseline justify-between gap-4"
              >
                <span className="text-body-sm">
                  {item.itemName}
                  {item.itemType === 'product' ? (
                    <span className="text-muted-foreground"> × {item.quantity}</span>
                  ) : null}
                </span>
                <span data-numeric="" className="text-body-sm shrink-0 tabular-nums">
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-body-sm text-muted-foreground">Donation reference</dt>
              <dd data-numeric="" className="text-body-sm font-semibold">
                {donation!.reference}
              </dd>
            </div>
            {receipt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-body-sm text-muted-foreground">Receipt number</dt>
                <dd data-numeric="" className="text-body-sm font-semibold">
                  {receipt.receiptNumber}
                </dd>
              </div>
            ) : null}
          </dl>

          {/*
            The distinction that matters, stated where the donor will look for
            it. A receipt acknowledges a payment; Form 10BE is what the Income
            Tax Department issues for an 80G claim, after the annual filing.
          */}
          <p className="text-caption text-muted-foreground border-border mt-5 border-t pt-4">
            A copy of this receipt is on its way to your email. It acknowledges your payment; it is
            not a tax-exemption certificate. If you are claiming relief under Section 80G, Form 10BE
            reaches you separately after our annual Form 10BD filing.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {donation?.campaignSlug ? (
              <Button asChild variant="secondary">
                <Link href={`/campaigns/${donation.campaignSlug}`}>Back to the campaign</Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/campaigns">See other campaigns</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'settled' && (status === 'failed' || status === 'cancelled')) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="text-warning-foreground mx-auto size-8" aria-hidden="true" />
        <h1 className="text-h2 mt-4 font-bold">Your payment was not completed</h1>
        <p className="text-body text-muted-foreground mx-auto mt-3 max-w-prose">
          Nothing has been charged. This happens for all sorts of ordinary reasons — a card limit, a
          timed-out UPI request, a closed window.
        </p>
        <p className="text-body-sm text-muted-foreground mx-auto mt-3 max-w-prose">
          Your selection is still on the campaign page, so you can pick up where you left off.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {donation?.campaignSlug ? (
            <Button asChild>
              <Link href={`/campaigns/${donation.campaignSlug}#give`}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Try again
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href="/campaigns">Back to campaigns</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === 'timeout') {
    return (
      <Card className="p-8 text-center">
        <Clock className="text-muted-foreground mx-auto size-8" aria-hidden="true" />
        <h1 className="text-h2 mt-4 font-bold">This is taking longer than usual</h1>
        <Alert variant="warning" className="mx-auto mt-5 max-w-prose text-left">
          {/* The single most important sentence on this page. */}
          <strong>Please do not pay again.</strong> Your payment may still be going through. If
          money has left your account it will be recorded, and you will receive a receipt by email.
        </Alert>
        <p className="text-body-sm text-muted-foreground mx-auto mt-4 max-w-prose">
          Refresh this page in a few minutes, or contact us quoting reference{' '}
          <span data-numeric="" className="font-semibold">
            {reference}
          </span>{' '}
          and we will find it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-10 text-center">
      <Loader2 className="text-primary mx-auto size-7 animate-spin" aria-hidden="true" />
      <h1 className="text-h3 mt-4 font-semibold">Confirming your payment</h1>
      <p className="text-body-sm text-muted-foreground mx-auto mt-3 max-w-prose">
        We are waiting for our payment provider to confirm this with our server. It usually takes a
        few seconds. Please keep this page open and do not pay again.
      </p>
      <p className="text-caption text-muted-foreground mt-4">Reference {reference}</p>
    </Card>
  );
}
