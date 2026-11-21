'use client';

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

import { Button, formatCurrency } from '@sailent/ui';

/**
 * The phone's Donate bar (visual polish Phase 4, 2026-11-21).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT SHOWS ONLY WHILE THE DONATION CARD IS OUT OF VIEW.
 *
 * A bar fixed to the foot of a phone screen was removed once because it
 * covered the content and the focused control under it, and hid the basket
 * behind a tap. This one never sits over the card: it watches the in-page
 * card (`target`) and steps aside the moment any of it is on screen, so the
 * amount chips, the total and the card's own Donate button are never under
 * it. Its one action brings the card into view and puts focus in it; the
 * payment itself still starts from the card.
 *
 * Below `lg` only (from `lg` the card is in the sticky side column), and
 * never for a campaign that is closed or paused (the caller does not render
 * it then).
 * ══════════════════════════════════════════════════════════════════════════
 */
export function MobileDonateBar({
  target,
  focusTarget,
  total,
}: {
  /** The in-page donation card. */
  target: React.RefObject<HTMLElement | null>;
  /** Where focus goes when the card arrives (its first amount chip). */
  focusTarget?: React.RefObject<HTMLElement | null>;
  /** The basket total, in paise. */
  total: number;
}) {
  const [cardVisible, setCardVisible] = React.useState(true);

  React.useEffect(() => {
    const card = target.current;
    if (!card || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setCardVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [target]);

  // Room at the foot of the PAGE (footer included) below `lg`, so the bar
  // never hides the last lines when it shows over them.
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const narrow = window.matchMedia('(max-width: 63.999rem)');
    const apply = () => {
      document.body.style.paddingBottom = narrow.matches
        ? 'calc(5rem + env(safe-area-inset-bottom))'
        : '';
    };
    apply();
    narrow.addEventListener('change', apply);
    return () => {
      narrow.removeEventListener('change', apply);
      document.body.style.paddingBottom = '';
    };
  }, []);

  const label = total > 0 ? `Donate ${formatCurrency(total)}` : 'Donate';

  const goToCard = () => {
    const card = target.current;
    if (!card) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Clear of the sticky header (64px) with a little air.
    const top = card.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    (focusTarget?.current ?? card).focus({ preventScroll: true });
  };

  return (
    <div
      data-testid="mobile-donate-bar"
      data-visible={!cardVisible}
      hidden={cardVisible}
      className="border-border bg-surface/95 supports-[backdrop-filter]:bg-surface/85 z-(--z-sticky) fixed inset-x-0 bottom-0 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden"
    >
      <Button
        type="button"
        variant="action"
        size="lg"
        fullWidth
        onClick={goToCard}
        // Says where it goes — it opens the donation card, it does not pay —
        // and contains the visible words (WCAG 2.5.3). Also keeps it apart
        // from the card's own "Donate ₹…" button.
        aria-label={`Go to the donation card: ${label}`}
      >
        {label}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  );
}
