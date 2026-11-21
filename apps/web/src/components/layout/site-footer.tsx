import Image from 'next/image';
import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

import { getOrganisation } from '@/lib/content/organisation';
import { footerNav, legalNav, siteConfig } from '@/lib/site-config';

import { MobileFooter } from './mobile-footer';
import { SOCIAL_ICONS } from './social-icons';

/**
 * Site footer, simplified (visual polish Phase 3, owner 2026-11-21).
 *
 * A clean column grid on the page surface: the brand column (logo, mission
 * line, a quiet tagline, social links), the two link columns (`footerNav`:
 * Explore, Information), Contact us, and the legal row. Neutral headings with
 * no bars, muted links that turn brand on hover, plain contact icons, 40px
 * neutral social circles. The botanical corners, the handwritten tagline and
 * the coloured icon badges are gone.
 *
 * Kept from `AGENTS.md` §11 item 13: the columns and links, the legal row, and
 * no "Donate now" button (owner, 2026-10-16).
 */
export async function SiteFooter() {
  const year = new Date().getFullYear();
  const organisation = await getOrganisation();
  const { address } = organisation;
  const addressFirst = address.line1;
  const addressSecond = [address.city, address.state, address.country].filter(Boolean).join(', ');

  return (
    <footer className="border-border bg-surface text-muted-foreground relative mt-auto border-t print:hidden">
      {/* Mobile view (< md) */}
      <MobileFooter organisation={organisation} year={year} />

      {/* Desktop view (>= md) */}
      <div className="container-page relative z-10 py-7 max-md:hidden lg:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-3 lg:col-span-4">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/images/sailent-logo.png"
                alt="Sailent Foundation"
                width={1743}
                height={453}
                // Shown at most ~220px wide: without `sizes` the browser fetched the
                // 3840px rendition (44 KB) of the 1743px PNG (visual polish Phase 5).
                sizes="220px"
                className="h-[43.2px] w-auto object-contain md:h-[50.4px]"
              />
            </Link>

            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              Empowering communities through education, healthcare, and sustainable opportunities
              for a brighter tomorrow.
            </p>
            <p className="text-caption text-muted-foreground">People · Purpose · Possibilities</p>

            <ul className="flex flex-wrap gap-2.5 pt-1">
              {organisation.social.map((link) => {
                const Icon = SOCIAL_ICONS[link.label];
                return (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${siteConfig.name} on ${link.label}`}
                      className="border-border text-muted-foreground hover:border-border-strong hover:bg-muted hover:text-foreground duration-(--duration-fast) flex size-10 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {Icon ? (
                        <Icon className="size-4" aria-hidden="true" />
                      ) : (
                        <span aria-hidden="true" className="text-caption font-bold">
                          {link.label.slice(0, 1)}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Columns 2 and 3: the link groups (Explore, Information — `footerNav`) */}
          <div className="grid grid-cols-2 gap-6 lg:col-span-4">
            {footerNav.map((group) => {
              const id = `footer-${group.label.replace(/\s+/g, '-').toLowerCase()}`;
              return (
                <nav key={group.label} aria-labelledby={id}>
                  <h2 id={id} className="text-foreground mb-3 text-sm font-semibold">
                    {group.label}
                  </h2>
                  <ul className="space-y-1.5 text-sm">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="focus-visible:outline-ring hover:text-primary text-muted-foreground block py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              );
            })}
          </div>

          {/* Column 5: Contact us + Script Accent */}
          <div className="lg:col-span-4">
            <div>
              <h2 id="footer-contact" className="text-foreground mb-3 text-sm font-semibold">
                Contact us
              </h2>
              <address
                aria-labelledby="footer-contact"
                className="text-muted-foreground space-y-2.5 text-sm not-italic"
              >
                {addressFirst || addressSecond ? (
                  <div className="flex items-start gap-2.5">
                    <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
                      <MapPin className="size-4" aria-hidden="true" />
                    </span>
                    <span className="leading-snug">
                      {addressFirst}
                      {addressFirst && addressSecond ? <br /> : null}
                      {addressSecond}
                    </span>
                  </div>
                ) : null}

                {organisation.phoneDisplay && organisation.phoneHref ? (
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
                      <Phone className="size-4" aria-hidden="true" />
                    </span>
                    <a
                      href={`tel:${organisation.phoneHref}`}
                      className="focus-visible:outline-ring hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {organisation.phoneDisplay}
                    </a>
                  </div>
                ) : null}

                {organisation.email ? (
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
                      <Mail className="size-4" aria-hidden="true" />
                    </span>
                    <a
                      href={`mailto:${organisation.email}`}
                      className="focus-visible:outline-ring hover:text-primary break-words transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {organisation.email}
                    </a>
                  </div>
                ) : null}
                {/* Nothing configured yet: the contact form, rather than invented details. */}
                {!(addressFirst || addressSecond) &&
                !(organisation.phoneDisplay && organisation.phoneHref) &&
                !organisation.email ? (
                  <Link
                    href="/contact"
                    className="hover:text-primary underline underline-offset-4 transition-colors"
                  >
                    Send us a message
                  </Link>
                ) : null}
              </address>
            </div>
          </div>
        </div>

        {/* Bottom Sub-footer */}
        <div className="border-border text-muted-foreground mt-8 flex flex-col items-center justify-between gap-3 border-t pt-3.5 text-xs sm:flex-row">
          <p>
            © {year} <span className="text-foreground font-semibold">{siteConfig.name}</span>. All
            rights reserved.
          </p>

          <ul className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {legalNav.map((item, index) => (
              <li key={item.href} className="inline-flex items-center">
                {index > 0 && (
                  <span className="text-border-strong mx-2" aria-hidden="true">
                    ·
                  </span>
                )}
                <Link
                  href={item.href}
                  className="hover:text-foreground rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
