import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';

import { getOrganisation } from '@/lib/content/organisation';
import { footerNav, legalNav, siteConfig } from '@/lib/site-config';
import { HeartDoodle } from '@/components/home/focus-icons';
import { ScriptAccent } from '@/components/sections/script-accent';

import { BrandGlyph } from './brand-mark';
import { MobileFooter } from './mobile-footer';
import { SOCIAL_ICONS } from './social-icons';

/**
 * Site footer matching the approved warm design.
 *
 * Warm cream background (#FFF9F2), prominent brand lockup with mission text and
 * round social buttons, orange section heading bars, two short link columns,
 * contact details with peach icon badges, and the handwritten "People,
 * Purpose, Possibilities" script with heart flourish. No "Donate Now" button:
 * taken out of the footer at the owner's request (2026-10-16). The pages' own
 * donate buttons and the phone menu's Donate Now remain; the desktop header
 * bar has none.
 */
export async function SiteFooter() {
  const year = new Date().getFullYear();
  const organisation = await getOrganisation();
  const { address } = organisation;
  const addressFirst = address.line1;
  const addressSecond = [address.city, address.state, address.country].filter(Boolean).join(', ');

  return (
    // `overflow-clip`: the corner leaves sit 24px outside the footer, and unclipped they gave every page a sideways scroll.
    <footer className="border-border bg-surface dark:border-border dark:bg-surface relative mt-auto overflow-clip border-t text-[#475569] dark:text-slate-300 print:hidden">
      {/* Decorative botanical watermark corners from approved design */}
      <div
        className="pointer-events-none absolute -bottom-6 -left-6 select-none text-[#F4D9C4] opacity-25 dark:opacity-10"
        aria-hidden="true"
      >
        <svg width="220" height="160" viewBox="0 0 220 160" fill="currentColor">
          <path d="M0 160C30 100 90 60 170 30C120 90 60 140 0 160Z" />
          <path d="M40 160C80 110 140 80 220 70C170 115 100 150 40 160Z" opacity="0.75" />
          <path d="M10 160C50 130 90 105 150 95C110 125 60 150 10 160Z" opacity="0.5" />
        </svg>
      </div>
      <div
        className="pointer-events-none absolute -bottom-6 -right-6 select-none text-[#F4D9C4] opacity-25 dark:opacity-10"
        aria-hidden="true"
      >
        <svg
          width="220"
          height="160"
          viewBox="0 0 220 160"
          fill="currentColor"
          className="-scale-x-100"
        >
          <path d="M0 160C30 100 90 60 170 30C120 90 60 140 0 160Z" />
          <path d="M40 160C80 110 140 80 220 70C170 115 100 150 40 160Z" opacity="0.75" />
          <path d="M10 160C50 130 90 105 150 95C110 125 60 150 10 160Z" opacity="0.5" />
        </svg>
      </div>

      {/* Mobile view (< md) */}
      <MobileFooter organisation={organisation} year={year} />

      {/* Desktop view (>= md) */}
      <div className="container-page relative z-10 py-7 max-md:hidden lg:py-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-3 lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="text-primary flex size-9 shrink-0 items-center justify-center">
                <BrandGlyph className="size-8" />
              </span>
              <span>
                <span className="font-display block text-xl font-bold leading-tight tracking-tight">
                  <span className="text-[#0F172A] dark:text-white">Sailent</span>{' '}
                  <span className="text-primary">Foundation</span>
                </span>
                <span className="mt-0.5 block text-[11px] font-medium tracking-normal text-slate-500 dark:text-slate-400">
                  People • Progress • Possibilities
                </span>
              </span>
            </Link>

            <p className="max-w-xs text-sm leading-relaxed text-[#475569] dark:text-slate-400">
              Empowering communities through education, healthcare, and sustainable opportunities
              for a brighter tomorrow.
            </p>

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
                      className="focus-visible:outline-ring shadow-xs size-8.5 border-border bg-surface dark:border-border dark:bg-surface hover:text-primary flex items-center justify-center rounded-full border text-slate-700 transition-all hover:border-[#EB6A1F] focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-300 dark:hover:border-orange-500 dark:hover:text-orange-400"
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
                  <h2
                    id={id}
                    className="font-display text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-white"
                  >
                    {group.label}
                  </h2>
                  <div
                    className="h-0.75 mb-2 mt-1 w-6 rounded-full bg-[#EB6A1F]"
                    aria-hidden="true"
                  />
                  <ul className="space-y-1.5 text-sm">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="focus-visible:outline-ring hover:text-primary block py-0.5 text-[#475569] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-400 dark:hover:text-orange-400"
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

          {/* Column 5: Contact Us + Script Accent */}
          <div className="flex flex-col justify-between gap-6 lg:col-span-4 xl:flex-row">
            <div>
              <h2
                id="footer-contact"
                className="font-display text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-white"
              >
                Contact Us
              </h2>
              <div className="h-0.75 mb-2 mt-1 w-6 rounded-full bg-[#EB6A1F]" aria-hidden="true" />
              <address
                aria-labelledby="footer-contact"
                className="space-y-2.5 text-sm not-italic text-[#475569] dark:text-slate-400"
              >
                {addressFirst || addressSecond ? (
                  <div className="flex items-start gap-2.5">
                    <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] dark:bg-orange-950/50">
                      <MapPin className="size-3.5" aria-hidden="true" />
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
                    <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] dark:bg-orange-950/50">
                      <Phone className="size-3.5" aria-hidden="true" />
                    </span>
                    <a
                      href={`tel:${organisation.phoneHref}`}
                      className="focus-visible:outline-ring hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-orange-400"
                    >
                      {organisation.phoneDisplay}
                    </a>
                  </div>
                ) : null}

                {organisation.email ? (
                  <div className="flex items-center gap-2.5">
                    <span className="size-7.5 text-primary flex shrink-0 items-center justify-center rounded-full bg-[#FFEDD5] dark:bg-orange-950/50">
                      <Mail className="size-3.5" aria-hidden="true" />
                    </span>
                    <a
                      href={`mailto:${organisation.email}`}
                      className="focus-visible:outline-ring hover:text-primary break-words transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-orange-400"
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

            {/* Hand-drawn People Purpose Possibilities flourish */}
            <div className="hidden flex-col items-center justify-center pl-2 xl:flex">
              <div className="flex items-start gap-2">
                <ScriptAccent
                  size="sm"
                  className="leading-tight text-[#475569] dark:text-slate-400"
                >
                  <span className="block">People</span>
                  <span className="block ps-[0.45em]">Purpose</span>
                  <span className="block ps-[0.9em]">Possibilities</span>
                </ScriptAccent>
                <HeartDoodle className="text-primary mt-1 size-7 shrink-0" />
              </div>
              <svg
                viewBox="0 0 100 16"
                fill="none"
                className="mt-1 w-20 text-[#EB6A1F]"
                aria-hidden="true"
              >
                <path
                  d="M4 12C30 3 70 3 96 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Sub-footer */}
        <div className="border-border dark:border-border mt-6 flex flex-col items-center justify-between gap-3 border-t pt-3.5 text-xs text-[#64748B] sm:flex-row dark:text-slate-400">
          <p>
            © {year}{' '}
            <span className="font-semibold text-[#0F172A] dark:text-white">{siteConfig.name}</span>.
            All rights reserved.
          </p>

          <ul className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {legalNav.map((item, index) => (
              <li key={item.href} className="inline-flex items-center">
                {index > 0 && (
                  <span className="text-primary/40 mx-2" aria-hidden="true">
                    |
                  </span>
                )}
                <Link
                  href={item.href}
                  className="focus-visible:outline-ring hover:text-primary rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-orange-400"
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
