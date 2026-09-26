/**
 * Presentation formatters.
 *
 * Currency formatting happens HERE and nowhere else — no component formats
 * currency inline (decision A2). Indian digit grouping (₹4,20,000) is not
 * cosmetic: the Western grouping reads as foreign to the donors we serve.
 */

/**
 * Format paise as Indian currency.
 *
 * The rupee symbol is PREPENDED MANUALLY rather than obtained from
 * `style: 'currency'`, because engines disagree about it: WebKit renders
 * `"₹\u00a0900"` (with a non-breaking space) where Node and Chromium render
 * `"₹900"`.
 *
 * That disagreement is not cosmetic. The server renders one string and Safari
 * renders another, so React sees a text mismatch and throws a hydration error
 * (#418) on every page that displays money — which is most of them, for every
 * iOS visitor. Formatting the number and adding the symbol ourselves is
 * deterministic across engines.
 *
 * Grouping still comes from Intl, because Indian lakh/crore grouping
 * (₹4,20,000 rather than ₹420,000) is consistent across engines and is not
 * something to reimplement.
 */
export function formatCurrency(paise: number, options: { decimals?: boolean } = {}): string {
  const showDecimals = options.decimals ?? paise % 100 !== 0;
  const rupees = paise / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(rupees);
  return `₹${formatted}`;
}

/** Compact Indian notation for dense contexts: 4.2L, 1.2Cr. */
export function formatCurrencyCompact(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return formatCurrency(paise);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(value: string | Date, style: 'long' | 'short' = 'long'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: style,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/**
 * Progress as a percentage of a goal.
 * Deliberately NOT clamped at 100: an over-subscribed campaign is shown
 * honestly rather than pinned to a full bar (docs/design-system.md §5).
 */
export function percentOf(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.round((current / goal) * 100);
}

/** Days remaining, or null when there is no real deadline. No manufactured urgency. */
export function daysRemaining(endsAt: string | Date | null | undefined): number | null {
  if (!endsAt) return null;
  const end = typeof endsAt === 'string' ? new Date(endsAt) : endsAt;
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}
