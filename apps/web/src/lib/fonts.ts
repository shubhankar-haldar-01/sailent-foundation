import { Manrope } from 'next/font/google';

/**
 * Manrope ExtraBold, for the few headings whose approved designs set them
 * heavier than the site's 600/700 (2026-10-08): the programs hero and the
 * sign-in and sign-up pages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * NOT PART OF THE SITE-WIDE FONT SET (`app/layout.tsx` loads 600/700 only).
 *
 * One instance, shared, so every page that uses it asks for the same file;
 * a page that does not import it never downloads it. Apply `.className` to
 * the heading — it sets the family and the 800 weight together — and leave
 * `font-display`/`font-bold` off that element so the two do not compete.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const headingExtraBold = Manrope({ subsets: ['latin'], weight: '800', display: 'swap' });
