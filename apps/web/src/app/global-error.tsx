'use client';

import { BRAND_COLOURS } from '@/lib/brand-colours';

/**
 * Root error boundary.
 *
 * Catches failures in the root layout itself, so it must render its own
 * <html> and <body> and cannot rely on providers, fonts or the design system
 * — those are exactly what may have failed. Plain inline styles only, with
 * the token values from `lib/brand-colours.ts`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
          background: BRAND_COLOURS.page,
          color: BRAND_COLOURS.text,
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: BRAND_COLOURS.textMuted, marginBottom: '1.5rem', lineHeight: 1.6 }}>
            We hit an unexpected problem. Please try again — if it keeps happening, get in touch.
          </p>
          {error.digest ? (
            <p style={{ color: BRAND_COLOURS.textSubtle, fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: BRAND_COLOURS.brand,
              color: BRAND_COLOURS.surface,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
