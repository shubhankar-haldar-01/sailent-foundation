import Image from 'next/image';
import Link from 'next/link';
import { Phone } from 'lucide-react';

import type { Organisation } from '@/lib/content/organisation';
import { footerNav, legalNav, siteConfig } from '@/lib/site-config';

import { BackToTop } from './back-to-top';
import { SOCIAL_ICONS_GLYPH } from './social-icons';

/**
 * Mobile footer, simplified (visual polish Phase 3, owner 2026-11-21).
 *
 * Kept from the owner's 2026-10-16 design (`AGENTS.md` §11 item 13): the
 * brand, mission and social links centred; Explore and Information side by
 * side and always open (no accordions); Contact us; Back to top; the
 * copyright and legal links centred; no "Donate now" button.
 *
 * Changed: neutral headings with no bars, Contact us without the card, a
 * quiet one-line tagline instead of the handwritten script, a plain
 * copyright row on a hairline, 40px neutral social circles.
 */

/*
  The contact card's marks, solid, as the owner's design draws them. Drawn
  here rather than taken from the icon set, which has outlines only; the
  phone is the icon set's handset, filled.
*/
function PinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="5 2 14 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z"
      />
    </svg>
  );
}

function MailMark({ className }: { className?: string }) {
  return (
    <svg viewBox="2 5 20 14" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3.4 5h17.2c.77 0 1.4.63 1.4 1.4v.55l-10 6.15L2 6.95V6.4C2 5.63 2.63 5 3.4 5Zm-1.4 4.1 9.48 5.83a1 1 0 0 0 1.04 0L22 9.1v8.5c0 .77-.63 1.4-1.4 1.4H3.4c-.77 0-1.4-.63-1.4-1.4Z" />
    </svg>
  );
}
export function MobileFooter({ organisation, year }: { organisation: Organisation; year: number }) {
  const { address } = organisation;
  const addressFirst = address.line1;
  const addressSecond = [address.city, address.state, address.country].filter(Boolean).join(', ');

  // The organisation's own details, and nothing in their place: in development
  // `getOrganisation` supplies the demo ones (`lib/demo-org.ts`), never in production.
  const addressLines = [addressFirst, addressSecond].filter(Boolean);
  const phone =
    organisation.phoneDisplay && organisation.phoneHref
      ? { display: organisation.phoneDisplay, href: organisation.phoneHref }
      : null;
  const email = organisation.email;
  const hasContact = addressLines.length > 0 || phone !== null || Boolean(email);

  return (
    <div className="relative z-10 px-5 pb-6 pt-6 md:hidden">
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/sailent-logo.png"
            alt="Sailent Foundation"
            width={1743}
            height={453}
            // Shown at most ~220px wide: without `sizes` the browser fetched the
            // 3840px rendition (44 KB) of the 1743px PNG (visual polish Phase 5).
            sizes="220px"
            className="h-[39.6px] w-auto object-contain sm:h-[43.2px]"
          />
        </Link>

        <p className="text-muted-foreground mt-5 max-w-[20rem] text-[13px] leading-5">
          Empowering communities through education, healthcare, and sustainable opportunities for a
          brighter tomorrow.
        </p>

        {organisation.social.length > 0 ? (
          <ul className="mt-4 flex flex-wrap justify-center gap-2.5">
            {organisation.social.map((link) => {
              const Icon = SOCIAL_ICONS_GLYPH[link.label];
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
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-10">
        {footerNav.map((group) => {
          const id = `mobile-footer-${group.label.replace(/\s+/g, '-').toLowerCase()}`;
          return (
            <nav key={group.label} aria-labelledby={id} className="min-w-0">
              <h2 id={id} className="text-foreground text-sm font-semibold leading-5">
                {group.label}
              </h2>
              <ul className="mt-2">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="hover:text-primary text-muted-foreground block rounded-sm py-1.5 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
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

      <section aria-labelledby="mobile-footer-contact" className="border-border mt-7 border-t pt-6">
        <h2 id="mobile-footer-contact" className="text-foreground text-sm font-semibold leading-5">
          Contact us
        </h2>

        <address className="text-muted-foreground mt-3 flex flex-col gap-3 text-sm not-italic leading-5">
          {addressLines.length > 0 ? (
            <div className="flex gap-3">
              <span className="text-muted-foreground flex h-5 w-3.5 shrink-0 items-center">
                <PinMark className="h-3.5 w-[10px]" />
              </span>
              <span>
                {addressLines.map((line, index) => (
                  <span key={index} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          ) : null}

          {phone ? (
            <div className="flex gap-3">
              <span className="text-muted-foreground flex h-5 w-3.5 shrink-0 items-center">
                <Phone className="size-[13px] fill-current" strokeWidth={0} aria-hidden="true" />
              </span>
              <a
                href={`tel:${phone.href}`}
                className="hover:text-foreground rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {phone.display}
              </a>
            </div>
          ) : null}

          {email ? (
            <div className="flex gap-3">
              <span className="text-muted-foreground flex h-5 w-3.5 shrink-0 items-center">
                <MailMark className="h-2.5 w-3.5" />
              </span>
              <a
                href={`mailto:${email}`}
                className="focus-visible:outline-ring hover:text-primary break-all rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {email}
              </a>
            </div>
          ) : null}

          {/* Nothing configured yet: the contact form, rather than invented details. */}
          {hasContact ? null : (
            <Link
              href="/contact"
              className="hover:text-primary underline underline-offset-4 transition-colors"
            >
              Send us a message
            </Link>
          )}
        </address>
      </section>

      {/*
        The tagline, centred, with Back to top beside it (the copyright row
        holds only the notice and the legal links, owner 2026-10-16). The side
        columns are equal so the tagline stays centred; below 360px the button
        is 36px so all three fit with air between.
      */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        <p className="text-caption text-muted-foreground col-start-2">
          People · Purpose · Possibilities
        </p>
        <BackToTop className="size-9 justify-self-end min-[360px]:size-11" />
      </div>

      <div className="border-border text-muted-foreground -mx-5 -mb-6 mt-6 border-t px-3 pb-[15px] pt-[13px] text-center text-[13px] leading-5">
        <p>
          Copyright © {year}{' '}
          <span className="text-foreground font-semibold">{siteConfig.name}</span>.{' '}
          <span className="whitespace-nowrap">All rights reserved.</span>
        </p>

        <ul className="mt-[11px] flex flex-wrap justify-center gap-x-3.5 gap-y-1">
          {legalNav.map((item) => (
            <li key={item.href}>
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
  );
}
