import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';

import { cn, formatCurrency } from '@sailent/ui';

import type { DonorDonation } from '@/lib/donor/api';

import { EmptyState } from './empty-state';
import { fitRow } from './fit';
import { formatDayMonthYear } from './format';
import { Panel, PanelHeader } from './panel';
import { StatusPill } from './status-pill';

/**
 * Recent payments (design, 2026-10-08): a table from `md` up, one card per
 * payment below it — the same rows, never a sideways-scrolling table on a
 * phone. On a desktop it shows as many rows as fit the screen (`fit.ts`).
 *
 * Each row's campaign is a link to the donation's own page; the receipt
 * column opens the receipt when one has been issued, and says so when it has
 * not — a failed or pending donation has no receipt, and that stays visible
 * rather than hidden.
 */
export function RecentPayments({ donations }: { donations: DonorDonation[] }) {
  return (
    <Panel className="p-5 sm:p-6 xl:p-[1.125rem]">
      <section aria-labelledby="payments-heading">
        <PanelHeader
          id="payments-heading"
          title="Recent Payments"
          action={
            donations.length > 0 ? (
              <PanelLink href="/dashboard/donations">View All Payments</PanelLink>
            ) : null
          }
        />

        {donations.length === 0 ? (
          <EmptyState
            className="mt-5 xl:mt-3"
            title="No payments yet"
            description="Your successful donations will appear here."
            action={{ label: 'Explore Campaigns', href: '/campaigns' }}
          />
        ) : (
          <>
            {/* From `md`: the table. */}
            <div className="mt-5 hidden md:block xl:mt-2.5">
              <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                <colgroup>
                  <col className="w-[6.75rem]" />
                  <col className="w-[10.75rem]" />
                  <col />
                  <col className="w-[5.5rem]" />
                  <col className="w-[6rem]" />
                  <col className="w-[4.25rem]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/60 text-caption text-muted-foreground font-medium">
                    <Th className="rounded-l-lg">Date</Th>
                    <Th>Transaction ID</Th>
                    <Th>Campaign</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                    <Th className="rounded-r-lg text-right">Receipt</Th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((donation, index) => (
                    <tr key={donation.id} className={cn('text-body-sm', fitRow(index))}>
                      <Td className="whitespace-nowrap">
                        {formatDayMonthYear(donation.donationDate)}
                      </Td>
                      <Td>
                        {/* In full, on one line, a size down. Real references are 12 characters
                            ("DON-" and eight); the column fits the 16 of the demo ones. */}
                        <span data-numeric="" className="block whitespace-nowrap text-[0.8125rem]">
                          {donation.reference}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={`/dashboard/donations/${donation.id}`}
                          className="text-foreground focus-visible:outline-ring line-clamp-2 rounded-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {donation.campaignTitle ?? 'General fund'}
                        </Link>
                      </Td>
                      <Td className="text-right">
                        <span data-numeric="" className="font-semibold tabular-nums">
                          {formatCurrency(donation.amount)}
                        </span>
                      </Td>
                      <Td>
                        <StatusPill status={donation.status} />
                      </Td>
                      <Td className="text-right">
                        <ReceiptAction donation={donation} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Below `md`: one card per payment. */}
            <ul className="mt-4 space-y-3 md:hidden">
              {donations.map((donation) => (
                <li key={donation.id} className="border-border/70 rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/donations/${donation.id}`}
                        className="text-body-sm text-foreground focus-visible:outline-ring block rounded-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {donation.campaignTitle ?? 'General fund'}
                      </Link>
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatDayMonthYear(donation.donationDate)}
                      </p>
                    </div>
                    <span data-numeric="" className="text-body shrink-0 font-semibold tabular-nums">
                      {formatCurrency(donation.amount)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusPill status={donation.status} />
                    <ReceiptAction donation={donation} />
                  </div>
                  <p data-numeric="" className="text-caption text-muted-foreground mt-2 break-all">
                    ID {donation.reference}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </Panel>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn('px-3 py-2.5 xl:py-2', className)}>{children}</th>;
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td className={cn('border-border/70 border-b px-3 py-3.5 align-middle xl:py-1.5', className)}>
      {children}
    </td>
  );
}

/** The receipt button, or a plain mark where no receipt has been issued yet. */
function ReceiptAction({ donation }: { donation: DonorDonation }) {
  if (!donation.receiptId) {
    return (
      <span className="text-muted-foreground inline-flex min-h-9 items-center xl:min-h-8">
        <span aria-hidden="true">—</span>
        <span className="sr-only">No receipt yet</span>
      </span>
    );
  }
  return (
    <Link
      href={`/dashboard/donations/${donation.id}/receipt`}
      aria-label={`Receipt for donation ${donation.reference}`}
      className="bg-muted text-foreground hover:bg-border/70 focus-visible:outline-ring inline-grid size-9 place-items-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 xl:size-8"
    >
      <FileText className="size-[1.125rem]" aria-hidden="true" />
    </Link>
  );
}

/** "View All … →" in the panel's corner. */
export function PanelLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-body-sm text-primary focus-visible:outline-ring group inline-flex min-h-9 items-center gap-1.5 rounded-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 xl:min-h-8"
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
