import { cn } from '@sailent/ui';

/**
 * A grid that adapts its column count to how many cards it actually has.
 *
 * The reference design assumes full rows. Real data does not co-operate: four
 * programs in a four-column grid looks designed, two campaigns in the same
 * grid looks broken — a row with two cards and two empty columns reads as a
 * loading failure rather than as a complete section.
 *
 * So the column count is the SMALLER of the design maximum and the number of
 * items. Two campaigns render as two half-width cards, which looks deliberate,
 * because it is.
 */
const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
} as const;

export function CardGrid({
  children,
  count,
  max = 4,
  className,
}: {
  children: React.ReactNode;
  /** How many cards are being rendered. */
  count: number;
  /** The design's column count for a full row. */
  max?: 2 | 3 | 4;
  className?: string;
}) {
  const columns = Math.min(max, Math.max(count, 1)) as 1 | 2 | 3 | 4;

  return (
    <ul
      className={cn(
        'mt-9 grid gap-5',
        // A single card does not stretch to the full width: a lone card three
        // columns wide is a banner, not a card, and stops matching its
        // siblings elsewhere on the page.
        columns === 1 ? 'max-w-sm sm:grid-cols-1' : COLUMNS[columns],
        className,
      )}
    >
      {children}
    </ul>
  );
}
