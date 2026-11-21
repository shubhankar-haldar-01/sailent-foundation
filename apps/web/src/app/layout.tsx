import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { AppProviders } from '@/providers';
import { getOrganisation } from '@/lib/content/organisation';
import { jsonLd, organizationSchema } from '@/lib/seo/structured-data';
import { siteConfig } from '@/lib/site-config';
import { canonicalUrl } from '@/lib/seo/metadata';

import '@/styles/globals.css';

/**
 * Fonts.
 *
 * Self-hosted via next/font — no render-blocking request to a third party, no
 * layout shift, and no data sent to Google from a donor's browser.
 *
 * `display: swap` plus a metric-compatible fallback keeps text readable during
 * load on the connections our donors actually use.
 *
 * ONE TYPEFACE (owner, 2026-11-21, visual polish direction 2): Inter, at
 * 400 (text), 500 (labels) and 600 (headings, buttons, figures). Only these
 * weights are loaded, so `font-bold` renders at 600: the cap is part of the
 * system. Headings get their slight negative tracking from the base layer
 * (tokens.css). Manrope and the Caveat script accent were retired with this
 * decision.
 *
 * It still needs a Devanagari companion before any Hindi content ships.
 */
const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
  // 'Inter Fallback' is defined in globals.css: Turbopack (Next.js 16) stopped
  // generating it for Inter, so next/font's own adjustment is off here and the
  // same metrics come from that @font-face instead.
  adjustFontFallback: false,
  fallback: ['Inter Fallback', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  alternates: { canonical: canonicalUrl('/') },
  // Indexing is enabled per-route. Transactional and private routes opt out
  // explicitly via buildMetadata({ noIndex: true }).
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover, so safe-area insets work on notched devices.
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Contact details from Admin → Settings (Phase 13). Never throws.
  const organisation = await getOrganisation();

  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      /*
        `scroll-behavior: smooth` is set on <html> (tokens.css) for in-page
        anchors. This attribute asks Next.js (16+) to suspend it during page
        navigations, so a new page still starts at the top at once rather than
        gliding up from where the last one was (the behaviour Next 15 had by
        default).
      */
      data-scroll-behavior="smooth"
      className={bodyFont.variable}
    >
      <body className="min-h-dvh antialiased">
        {/*
          Organization schema, site-wide.
          Note it emits contact and address (from Admin → Settings, Phase 13)
          but NOT the statutory registration numbers: structured data asserting
          a registration is exactly the misleading markup docs/seo-strategy.md
          §5 rules out until it is verified. Adding them is SEO work (Phase 15).
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(
            organizationSchema({
              email: organisation.email ?? undefined,
              phone: organisation.phoneDisplay ?? undefined,
              logoUrl: `${siteConfig.url}/images/sailent-logo.png`,
              ...(organisation.address.line1 || organisation.address.city
                ? {
                    address: {
                      street: [organisation.address.line1, organisation.address.line2]
                        .filter(Boolean)
                        .join(', '),
                      city: organisation.address.city ?? '',
                      state: organisation.address.state ?? '',
                      postalCode: organisation.address.postalCode ?? '',
                    },
                  }
                : {}),
              socialProfiles: organisation.social.map((link) => link.url),
            }),
          )}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
