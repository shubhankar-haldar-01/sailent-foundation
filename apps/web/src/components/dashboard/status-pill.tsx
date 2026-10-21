import { cn } from '@sailent/ui';

/**
 * A donation's status, in the donor's words rather than the database's.
 *
 * `successful` is shown as "Received", because that is the thing the donor
 * wants confirmed — the word "successful" describes the payment, not the gift.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. Each pill carries its label, so it reads
 * correctly in greyscale and to anyone who cannot separate the hues.
 */
const LABELS: Record<string, { label: string; className: string }> = {
  successful: {
    label: 'Received',
    className: 'bg-[#EAF8F0] text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  pending: {
    label: 'Awaiting payment',
    className: 'bg-[#FEF6EC] text-[#92400E] dark:bg-amber-950/40 dark:text-amber-300',
  },
  processing: {
    label: 'Processing',
    className: 'bg-[#FEF6EC] text-[#92400E] dark:bg-amber-950/40 dark:text-amber-300',
  },
  failed: {
    label: 'Failed',
    className: 'bg-[#FDF2F2] text-[#B91C1C] dark:bg-rose-950/40 dark:text-rose-300',
  },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const tone = LABELS[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
        tone.className,
        className,
      )}
    >
      {tone.label}
    </span>
  );
}
