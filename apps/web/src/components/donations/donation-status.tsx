'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, RotateCcw } from 'lucide-react';

import { Alert, Button, Card, Spinner } from '@sailent/ui';

import { DonationSuccess, type ReceiptOrganisation } from './donation-success';

export type { ReceiptOrganisation } from './donation-success';

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
  donorName: string | null;
  programTitle: string | null;
}

/** The waiting, failed and missing states keep the narrow column they had. */
function Narrow({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl">{children}</div>;
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
export function DonationStatus({
  reference,
  organisation,
}: {
  reference: string;
  organisation: ReceiptOrganisation;
}) {
  const [donation, setDonation] = React.useState<DonationView | null>(null);
  const [receipt, setReceipt] = React.useState<ReceiptView | null>(null);
  const [phase, setPhase] = React.useState<
    'loading' | 'settled' | 'waiting' | 'timeout' | 'missing'
  >('loading');

  React.useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let settledNow = false;
    let timer: number | undefined;
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
          settledNow = true;
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
        timer = window.setTimeout(() => void poll(), delay);
      } catch {
        if (cancelled) return;
        if (attempt >= delays.length) {
          setPhase('timeout');
          return;
        }
        const delay = delays[attempt] ?? 20_000;
        attempt += 1;
        timer = window.setTimeout(() => void poll(), delay);
      }
    }

    /*
      BACK ONLINE: ASK AGAIN NOW (Phase 3 of the UI feedback system). A
      connection lost while waiting must not leave the page on "taking longer
      than usual" once it returns: the status is checked again straight away,
      and the wait starts over, before any result is shown.
    */
    function onOnline() {
      if (cancelled || settledNow) return;
      window.clearTimeout(timer);
      attempt = 0;
      setPhase((current) => (current === 'timeout' ? 'waiting' : current));
      void poll();
    }
    window.addEventListener('online', onOnline);

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
      window.clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [reference]);

  if (phase === 'loading') {
    return (
      <Narrow>
        <Card className="p-10 text-center">
          <Spinner className="text-muted-foreground mx-auto size-6" />
          <p className="text-body-sm text-muted-foreground mt-4">Looking up your donation…</p>
        </Card>
      </Narrow>
    );
  }

  if (phase === 'missing') {
    return (
      <Narrow>
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
      </Narrow>
    );
  }

  const status = donation?.status;

  if (phase === 'settled' && status === 'successful') {
    return <DonationSuccess donation={donation!} receipt={receipt} organisation={organisation} />;
  }

  if (phase === 'settled' && (status === 'failed' || status === 'cancelled')) {
    return (
      <Narrow>
        <Card className="p-8 text-center">
          <AlertTriangle className="text-warning-foreground mx-auto size-8" aria-hidden="true" />
          <h1 className="text-h2 mt-4 font-bold">Your payment was not completed</h1>
          <p className="text-body text-muted-foreground mx-auto mt-3 max-w-prose">
            Nothing has been charged. This happens for all sorts of ordinary reasons — a card limit,
            a timed-out UPI request, a closed window.
          </p>
          <p className="text-body-sm text-muted-foreground mx-auto mt-3 max-w-prose">
            Your selection is still on the campaign page, so you can pick up where you left off.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {donation?.campaignSlug ? (
              <Button asChild variant="action">
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
      </Narrow>
    );
  }

  if (phase === 'timeout') {
    return (
      <Narrow>
        <Card className="p-8 text-center">
          <Clock className="text-muted-foreground mx-auto size-8" aria-hidden="true" />
          <h1 className="text-h2 mt-4 font-bold">This is taking longer than usual</h1>
          <Alert variant="warning" className="mx-auto mt-5 max-w-prose text-left">
            {/* The single most important sentence on this page. */}
            <strong>Please do not pay again.</strong> Your payment may still be going through. If
            money has left your account it will be recorded, and you will receive a receipt by
            email.
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
      </Narrow>
    );
  }

  return (
    <Narrow>
      <Card className="p-10 text-center">
        <Spinner className="text-primary mx-auto size-7" />
        <h1 className="text-h3 mt-4 font-semibold">Confirming your payment</h1>
        <p className="text-body-sm text-muted-foreground mx-auto mt-3 max-w-prose">
          We are waiting for our payment provider to confirm this with our server. It usually takes
          a few seconds. Please keep this page open and do not pay again.
        </p>
        <p className="text-caption text-muted-foreground mt-4">Reference {reference}</p>
      </Card>
    </Narrow>
  );
}
