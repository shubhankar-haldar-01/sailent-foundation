'use client';

/**
 * Root error boundary.
 *
 * Catches failures in the root layout itself, so it must render its own
 * <html> and <body> and cannot rely on providers, fonts or the design system
 * — those are exactly what may have failed. Plain inline styles only.
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
          background: '#fafaf9',
          color: '#1c1917',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#57534e', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            We hit an unexpected problem. Please try again — if it keeps happening, get in touch.
          </p>
          {error.digest ? (
            <p style={{ color: '#78716c', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
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
              background: '#1c1917',
              color: '#fff',
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
