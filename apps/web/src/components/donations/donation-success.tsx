'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Info, Lock, Share2 } from 'lucide-react';

import { Button, Card, formatCurrency, toast } from '@sailent/ui';
import { rupeesInWords } from '@sailent/validation';

import { useAsyncAction } from '@/lib/feedback/use-async-action';

/**
 * A successful donation: the page a donor lands on after paying.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE OWNER'S LAYOUT (2026-11-19), IN THE BRAND'S COLOURS, IN ONE SCREEN.
 *
 * A receipt-style card (the thanks, the amount in figures and words, then the
 * payment, donation and organisation details side by side) beside a summary
 * with the download, the tax note and where to get help. From `lg` it is
 * sized to fit a laptop screen under the site header without scrolling
 * (owner, 2026-11-19: checked at 1280×720 and 1460×725). Below `lg` it stacks.
 *
 * WHAT IT DOES NOT SHOW, ON PURPOSE. Anyone who holds this page's link can
 * open it, so it carries no payment identifier, no PAN of the donor and no
 * email address (owner, 2026-11-19); those are in the receipt email. The
 * organisation's PAN, 80G, 12A and registration numbers appear only when they
 * have been entered in Admin → Settings, and the summary has no fee lines or
 * security claims that are not records (AGENTS.md §10).
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface SuccessDonation {
  reference: string;
  amount: number;
  donationType: string;
  campaignSlug: string | null;
  campaignTitle: string | null;
  donorName: string | null;
  completedAt: string | null;
  items: { itemType: string; itemName: string; quantity: number; totalPrice: number }[];
}

export interface SuccessReceipt {
  receiptNumber: string;
  issuedAt: string;
  donorName: string | null;
  programTitle: string | null;
}

/** The organisation's details as entered in Admin → Settings; null where none was. */
export interface ReceiptOrganisation {
  name: string;
  email: string | null;
  phoneDisplay: string | null;
  phoneHref: string | null;
  pan: string | null;
  section80G: string | null;
  section12A: string | null;
  registrationNumber: string | null;
}

const DONATION_TYPE: Record<string, string> = {
  custom: 'One-time · Amount of your choice',
  product: 'One-time · Items',
  hybrid: 'One-time · Items and an amount',
};

const IST_DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
const IST_TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

const EYEBROW = 'text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.08em] uppercase';

function Field({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd
        data-numeric={mono ? '' : undefined}
        className={`text-body-sm mt-0.5 break-words font-semibold ${mono ? 'tracking-wide' : ''}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** One of the three detail groups: a column from `sm`, stacked below. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h2 className={EYEBROW}>{title}</h2>
      <dl className="mt-2 space-y-2">{children}</dl>
    </section>
  );
}

/** Shares the CAMPAIGN, never this page: this page's link is private to the donor. */
function ShareCampaign({ slug, title }: { slug: string; title: string }) {
  async function share() {
    const url = `${window.location.origin}/campaigns/${slug}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: `Support ${title} with Sailent Foundation`, url });
      } catch {
        // Closing the share sheet is not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.copied('Campaign link copied');
    } catch {
      // No clipboard: the link itself, to copy by hand.
      toast.info('Copy this link to share', { description: url, duration: 10_000 });
    }
  }

  return (
    <Button
      type="button"
      variant="subtle"
      className="border-border-strong bg-surface w-full border"
      onClick={() => void share()}
    >
      <Share2 aria-hidden="true" />
      Share this campaign
    </Button>
  );
}

/**
 * Downloads the receipt PDF with a loading state and a toast either way
 * (Phase 3 of the UI feedback system), instead of a plain link that gives no
 * sign of progress or failure.
 */
function DownloadReceipt({
  reference,
  receiptNumber,
}: {
  reference: string;
  receiptNumber: string;
}) {
  const download = useAsyncAction(
    async () => {
      const response = await fetch(
        `/api/bff/donations/${encodeURIComponent(reference)}/receipt/pdf`,
        {
          cache: 'no-store',
        },
      );
      if (!response.ok) {
        throw Object.assign(new Error('receipt download failed'), {
          code: response.status === 404 ? 'NOT_FOUND' : 'SERVICE_UNAVAILABLE',
          status: response.status,
        });
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Donation-receipt-${receiptNumber}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    { success: 'Receipt downloaded', errorTitle: 'Couldn’t download the receipt' },
  );

  return (
    <Button
      type="button"
      className="w-full"
      isLoading={download.pending}
      loadingText="Preparing receipt…"
      onClick={() => void download.run()}
    >
      <Download aria-hidden="true" />
      Download receipt (PDF)
    </Button>
  );
}

export function DonationSuccess({
  donation,
  receipt,
  organisation,
}: {
  donation: SuccessDonation;
  receipt: SuccessReceipt | null;
  organisation: ReceiptOrganisation;
}) {
  const paidAt = donation.completedAt ?? receipt?.issuedAt ?? null;
  const when = paidAt ? new Date(paidAt) : null;
  const campaign = donation.campaignTitle ?? 'our work';
  const donorName = receipt?.donorName ?? donation.donorName;
  const firstName = donation.donorName;

  const registrations = [
    ['Organisation PAN', organisation.pan],
    ['80G registration no.', organisation.section80G],
    ['12A registration no.', organisation.section12A],
    ['Registration no.', organisation.registrationNumber],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── The receipt ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden p-0">
        <div className="bg-surface bg-[radial-gradient(600px_200px_at_90%_-20%,var(--success-subtle),transparent_70%),radial-gradient(480px_180px_at_-5%_120%,var(--info-subtle),transparent_70%)] px-6 pb-4 pt-5 sm:px-8">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div
              className="bg-success grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_0_0_6px_color-mix(in_oklab,var(--success)_16%,transparent),0_0_0_12px_color-mix(in_oklab,var(--success)_7%,transparent)]"
              aria-hidden="true"
            >
              <Check className="size-6" strokeWidth={3} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-h3 font-bold">Thank you{firstName ? `, ${firstName}` : ''}!</h1>
              <p className="text-body-sm text-muted-foreground mt-1">
                Your donation to <strong className="text-foreground">{campaign}</strong> was
                successful. A receipt is on its way to your email.
              </p>
            </div>
            <p className="bg-success-subtle text-success border-success/30 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold lg:hidden xl:inline-flex">
              <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
              Payment successful
            </p>
          </div>

          <div className="border-border mt-4 flex flex-col gap-4 border-t border-dashed pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={EYEBROW}>Amount paid</p>
              <p
                data-numeric=""
                className="font-display mt-1.5 text-[2.5rem] font-bold tabular-nums leading-none"
              >
                {formatCurrency(donation.amount)}
              </p>
              <p className="text-caption text-muted-foreground mt-1.5">
                {rupeesInWords(donation.amount)} · INR
              </p>
            </div>
            {when ? (
              <div className="sm:text-right">
                <p className={EYEBROW}>Date &amp; time</p>
                <p className="text-body-sm mt-1">
                  <strong>{IST_DATE.format(when)}</strong>
                  <span className="text-muted-foreground"> · {IST_TIME.format(when)} IST</span>
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-border grid gap-6 border-t px-6 py-4 sm:grid-cols-3 sm:px-8">
          <Group title="Payment details">
            <Field label="Status">
              <span className="text-success">Successful</span>
            </Field>
            <Field label="Payment method">Online · Razorpay</Field>
            <Field label="Donation type">
              {DONATION_TYPE[donation.donationType] ?? 'One-time'}
            </Field>
          </Group>

          <Group title="Donation details">
            <Field label="Campaign">
              {campaign}
              {receipt?.programTitle ? (
                <span className="text-caption text-muted-foreground block font-normal">
                  {receipt.programTitle} programme
                </span>
              ) : null}
            </Field>
            <Field label="Donation reference" mono>
              {donation.reference}
            </Field>
            {receipt ? (
              <Field label="Receipt number" mono>
                {receipt.receiptNumber}
              </Field>
            ) : null}
          </Group>

          <Group title="Donor and organisation">
            {donorName ? <Field label="Donor name">{donorName}</Field> : null}
            <Field label="Received by">{organisation.name}</Field>
            {registrations.map(([label, value]) => (
              <Field key={label} label={label} mono>
                {value}
              </Field>
            ))}
          </Group>
        </div>

        <div className="border-border flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:px-8">
          {donation.campaignSlug ? (
            <Button asChild variant="secondary" className="sm:flex-1">
              <Link href={`/campaigns/${donation.campaignSlug}`}>
                <ArrowLeft aria-hidden="true" />
                Back to the campaign
              </Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant="subtle"
            className="bg-info-subtle text-info-action hover:bg-info-subtle/70 sm:flex-1"
          >
            <Link href="/campaigns">See other campaigns</Link>
          </Button>
        </div>
      </Card>

      {/* ── Summary, tax note, help ───────────────────────────────────────── */}
      <aside className="space-y-3" aria-label="Payment summary and help">
        <Card className="px-5 py-4">
          <h2 className="text-body font-semibold">Payment summary</h2>
          <ul className="mt-2.5">
            {donation.items.map((item, index) => (
              <li
                key={`${item.itemName}-${index}`}
                className="text-body-sm text-muted-foreground flex items-baseline justify-between gap-4 py-1"
              >
                <span>
                  {item.itemName}
                  {item.itemType === 'product' ? ` × ${item.quantity}` : ''}
                </span>
                <span data-numeric="" className="text-foreground shrink-0 tabular-nums">
                  {formatCurrency(item.totalPrice)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-border mt-2 flex items-center justify-between border-t pt-3">
            <span className="text-body-sm font-bold">Total paid</span>
            <span data-numeric="" className="text-h4 font-bold tabular-nums">
              {formatCurrency(donation.amount)}
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {receipt ? (
              <DownloadReceipt
                reference={donation.reference}
                receiptNumber={receipt.receiptNumber}
              />
            ) : null}
            {donation.campaignSlug ? (
              <ShareCampaign slug={donation.campaignSlug} title={campaign} />
            ) : null}
          </div>

          <p className="text-caption text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            <Lock className="text-success size-3.5" aria-hidden="true" />
            Payment processed securely by Razorpay
          </p>
        </Card>

        {/*
          The distinction that matters, stated where the donor will look for
          it. A receipt acknowledges a payment; Form 10BE is what the Income Tax
          Department issues for an 80G claim, after the annual filing.
        */}
        <Card className="border-warning/40 bg-warning-subtle flex gap-2.5 p-4">
          <Info className="text-warning-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-caption text-warning-foreground">
            <strong>About tax benefits.</strong> This receipt acknowledges your payment; it is not a
            tax-exemption certificate. If you are claiming relief under Section 80G, Form 10BE
            reaches you separately after our annual Form 10BD filing.
          </p>
        </Card>

        <Card className="text-caption text-muted-foreground p-4">
          <p>
            Need help with this payment? Quote{' '}
            <strong data-numeric="" className="text-foreground whitespace-nowrap">
              {donation.reference}
            </strong>{' '}
            {organisation.email || organisation.phoneDisplay ? (
              <>
                and{' '}
                {organisation.email ? (
                  <>
                    write to{' '}
                    <a
                      href={`mailto:${organisation.email}`}
                      className="text-info-action font-semibold underline-offset-4 hover:underline"
                    >
                      {organisation.email}
                    </a>
                  </>
                ) : null}
                {organisation.email && organisation.phoneDisplay ? ' or ' : null}
                {organisation.phoneDisplay ? (
                  <>
                    call{' '}
                    <a
                      href={organisation.phoneHref ?? undefined}
                      className="text-info-action whitespace-nowrap font-semibold underline-offset-4 hover:underline"
                    >
                      {organisation.phoneDisplay}
                    </a>
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                when you{' '}
                <Link
                  href="/contact"
                  className="text-info-action font-semibold underline-offset-4 hover:underline"
                >
                  contact us
                </Link>
                .
              </>
            )}{' '}
            Read our{' '}
            <Link
              href="/donation-policy"
              className="text-info-action font-medium underline-offset-4 hover:underline"
            >
              donation policy
            </Link>
            .
          </p>
        </Card>
      </aside>
    </div>
  );
}
