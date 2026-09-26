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
  successful: { label: 'Received', className: 'bg-success-subtle text-success' },
  pending: { label: 'Awaiting payment', className: 'bg-warning-subtle text-warning-foreground' },
  processing: { label: 'Processing', className: 'bg-warning-subtle text-warning-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive-subtle text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
};

export function StatusPill({ status }: { status: string }) {
  const tone = LABELS[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };

  return (
    <span
      className={cn(
        'text-caption inline-flex items-center rounded-full px-2.5 py-0.5 font-medium',
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}
