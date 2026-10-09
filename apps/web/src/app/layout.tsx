import type { Metadata, Viewport } from 'next';
import { Caveat, Inter, Manrope } from 'next/font/google';

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
 * TWO TYPEFACES, EACH WITH ONE JOB:
 *   • Manrope (600, 700) — `--font-heading`: brand, headings, card and
 *                         campaign titles, and the large figures (amounts,
 *                         impact numbers). Used through `font-display` and the
 *                         heading base rule — never set per page.
 *   • Inter (400, 500, 600) — `--font-body`: everything functional — body
 *                         copy, navigation, buttons, forms, tables, metadata,
 *                         the admin.
 * Only these weights are loaded. A `font-bold` on Inter text therefore renders
 * at 600, and anything heavier than 700 on Manrope at 700 — the cap is part of
 * the system, not an accident.
 *
 * Caveat stays as the handwritten accent over photography. It is decoration
 * ONLY: it never carries information that is not also present in real text.
 *
 * All three still need a Devanagari companion before any Hindi content ships.
 */
const bodyFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-body',
  fallback: ['system-ui', 'sans-serif'],
});

const headingFont = Manrope({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-heading',
  fallback: ['system-ui', 'sans-serif'],
});

const scriptFont = Caveat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-script-family',
  fallback: ['cursive'],
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
      className={`${bodyFont.variable} ${headingFont.variable} ${scriptFont.variable}`}
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
