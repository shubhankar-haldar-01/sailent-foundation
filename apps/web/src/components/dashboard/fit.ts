/**
 * ON A DESKTOP, THE DASHBOARD FITS THE SCREEN (owner, 2026-10-08).
 *
 * From `xl` (1280px), where the three columns sit side by side, the page is
 * sized so that the whole dashboard shows without scrolling. The lists are
 * what decide its height, so they show as many rows as the screen has room
 * for: two on a laptop-height screen (as the design shows), and a third,
 * fourth and fifth as the window gets taller. "View All Payments" leads to
 * the rest. Below `xl` the columns stack and the page scrolls as any phone
 * page does, so every row is shown.
 *
 * The heights are measured, not guessed (2026-10-08, at 1440–1920px wide):
 * with two rows of each list the dashboard ends 790px down the page, and
 * each further row of both lists adds at most 116px (58 + 58, when a campaign
 * name runs to two lines). Each threshold keeps 8px spare. The class strings are written out in full so Tailwind generates
 * them.
 */
const FIT_ROW = [
  '',
  '',
  '[@media(min-width:80rem)_and_(max-height:913px)]:hidden',
  '[@media(min-width:80rem)_and_(max-height:1029px)]:hidden',
  '[@media(min-width:80rem)_and_(max-height:1145px)]:hidden',
] as const;

/** The class that hides list row `index` on a desktop too short to show it. */
export function fitRow(index: number): string {
  return FIT_ROW[index] ?? 'xl:hidden';
}

/** How many rows the lists fetch: the most a tall desktop shows. */
export const DASHBOARD_ROWS = FIT_ROW.length;
