/**
 * Homepage sections hidden until their content is real (owner, 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE COMPONENTS STAY; ONLY THEIR SHOWING IS SWITCHED OFF.
 *
 * "In the spotlight" (`spotlight-section.tsx`) showed press marks — THE
 * COMMUNITY POST, Impact Journal, TODAY INDIA — and "Voices of hope and
 * change" (`testimonials.tsx`) showed named quotes from `lib/mock/home.ts`.
 * Neither is a record: no coverage or quote has been confirmed, and AGENTS.md
 * §10 and §12 forbid invented press names and testimonials. The owner had them
 * removed from the page and kept so they can return.
 *
 * TO RE-ENABLE: replace the content with real items (confirmed coverage; quotes
 * given with the person's consent), then set the flag to true. AGENTS.md §11
 * items 3 and 6 record this.
 * ══════════════════════════════════════════════════════════════════════════
 */
export const SHOW_PRESS_MENTIONS = false;
export const SHOW_TESTIMONIALS = false;
