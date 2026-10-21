import Link from 'next/link';
import { Download, FileText } from 'lucide-react';

interface ReceiptCardProps {
  donationId: string;
  receiptNumber?: string | null;
  paymentStatus: string;
}

/**
 * The donation's receipt: a download when there is one, otherwise why not.
 *
 * NOTHING TO WAIT FOR. A receipt is issued inside the payment-capture
 * transaction (decision A6), so a confirmed payment already has one when this
 * renders; there is no later moment for a refresh to catch, and polling for one
 * only repeated the page's requests. A successful donation without a receipt
 * is a row capture never touched (seed or hand-made data), and says so.
 */
export function ReceiptCard({ donationId, receiptNumber, paymentStatus }: ReceiptCardProps) {
  const isPaymentSuccessful = paymentStatus === 'successful';
  const isReceiptReady = Boolean(receiptNumber && isPaymentSuccessful);

  return (
    <div className="card-elevated dark:from-primary/10 dark:to-primary/5 dark:border-primary/20 flex flex-col justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#FFF5EC] to-[#FEF0E3] p-5 sm:flex-row sm:items-center sm:p-6">
      {/* Left Icon + Text */}
      <div className="flex items-center gap-4">
        <div className="dark:bg-primary/20 text-primary flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100/80">
          <FileText className="size-6 stroke-[2]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-foreground text-base font-bold sm:text-lg">
            Your donation receipt
          </h2>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            {isReceiptReady
              ? 'Your official donation receipt is ready to view and download.'
              : isPaymentSuccessful
                ? 'No receipt has been issued for this donation.'
                : 'Receipts are issued once payment has been confirmed.'}
          </p>
        </div>
      </div>

      {/* Right Action */}
      <div className="flex shrink-0 items-center">
        {isReceiptReady ? (
          <Link
            href={`/dashboard/donations/${donationId}/receipt`}
            className="bg-primary hover:bg-primary/90 text-primary-foreground focus-visible:outline-ring shadow-xs inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all focus-visible:outline-2"
          >
            <Download className="size-4" aria-hidden="true" />
            <span>Download receipt</span>
          </Link>
        ) : null}

        {!isPaymentSuccessful ? (
          <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold">
            Payment {paymentStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}
