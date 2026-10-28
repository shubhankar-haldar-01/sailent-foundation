import Image from 'next/image';
import Link from 'next/link';
import { Phone } from 'lucide-react';

import type { Organisation } from '@/lib/content/organisation';
import { footerNav, legalNav, siteConfig } from '@/lib/site-config';
import { HeartDoodle } from '@/components/home/focus-icons';
import { ScriptAccent } from '@/components/sections/script-accent';

import { BackToTop } from './back-to-top';
import { SOCIAL_ICONS_GLYPH } from './social-icons';

/**
 * Mobile footer matching the approved warm design.
 *
 * Warm cream background (#FFF9F2), sprout brand mark, mission blurb,
 * round social buttons, the Explore and Information links side by side,
 * contact details in a card, and the handwritten "People, Purpose,
 * Possibilities" script. No "Donate Now" button (owner, 2026-10-16).
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
      {/*
        BRAND, MISSION AND SOCIAL LINKS, CENTRED (owner's design, 2026-10-16).
        Measured from the design, which is about 1.67× a 390px phone: the
        lockup centred, the mission 13px on 20px lines in #555555 (7.5:1 on
        white), and the networks as 38px white circles with a hairline border
        and a soft shadow, their marks near-black.
      */}
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/sailent-logo.png"
            alt="Sailent Foundation"
            width={2048}
            height={746}
            className="h-11 w-auto object-contain sm:h-12"
          />
        </Link>

        <p className="mt-5 max-w-[20rem] text-[13px] leading-5 text-[#555555] dark:text-slate-400">
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
                    className="focus-visible:outline-ring size-9.5 dark:border-border dark:bg-surface hover:text-primary flex items-center justify-center rounded-full border border-[#E8E8E8] bg-white text-[#303030] shadow-[0_4px_10px_rgba(0,0,0,0.06)] transition-all hover:border-[#EB6A1F] focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-200 dark:shadow-none dark:hover:border-orange-500 dark:hover:text-orange-400"
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

      {/*
        EXPLORE AND INFORMATION, SIDE BY SIDE AND ALWAYS OPEN (owner's design,
        2026-10-16) — they were collapsed accordions. Colours are taken from
        the design: the heading #19013E, the bar #E9A944, the links #555555
        (7.5:1 on the white footer). The bar is decoration.

        Sized from the design at its own scale (about 1.67× a 390px phone, the
        same as the owner's screenshots): 16px headings, a 34×3px bar, 13px
        links on a 28px rhythm, the second column 195px along.
      */}
      <div className="mt-6 grid grid-cols-2 gap-x-10">
        {footerNav.map((group) => {
          const id = `mobile-footer-${group.label.replace(/\s+/g, '-').toLowerCase()}`;
          return (
            <nav key={group.label} aria-labelledby={id} className="min-w-0">
              <h2
                id={id}
                className="font-display text-base font-bold leading-5 tracking-tight text-[#19013E] dark:text-white"
              >
                {group.label}
              </h2>
              <div aria-hidden="true" className="mt-2 h-[3px] w-[34px] rounded-full bg-[#E9A944]" />
              <ul className="mt-1.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="focus-visible:outline-ring hover:text-primary block rounded-sm py-1 text-[13px] leading-5 text-[#555555] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-400 dark:hover:text-orange-400"
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

      {/*
        CONTACT US, AS A CARD (owner's design, 2026-10-16). Measured from the
        design at its scale: an 18px-radius card filled #FFFEFD with a #EDEDEB
        hairline and a soft shadow; the heading and bar as Explore's, centred;
        solid #E9A944 marks in a 14px column, the text 13px on 19px lines in
        #555555 starting 51px in, the rows 20px apart. The heading is ours
        ("Contact Us"), and so are the details. The phone keeps a handset: the
        design's WhatsApp mark would promise a chat this tel: link does not open.
      */}
      <section
        aria-labelledby="mobile-footer-contact"
        className="dark:border-border dark:bg-surface mt-7 rounded-[18px] border border-[#EDEDEB] bg-[#FFFEFD] px-5 pb-6 pt-[22px] shadow-[0_6px_18px_rgba(0,0,0,0.05)] dark:shadow-none"
      >
        <h2
          id="mobile-footer-contact"
          className="font-display text-center text-base font-bold leading-5 tracking-tight text-[#19013E] dark:text-white"
        >
          Contact Us
        </h2>
        <div
          aria-hidden="true"
          className="mx-auto mt-1.5 h-[3px] w-[34px] rounded-full bg-[#E9A944]"
        />

        <address className="mt-[18px] flex flex-col gap-5 text-[13px] not-italic leading-[19px] text-[#555555] dark:text-slate-400">
          {addressLines.length > 0 ? (
            <div className="flex gap-[17px]">
              <span className="flex h-[19px] w-3.5 shrink-0 items-center text-[#E9A944]">
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
            <div className="flex gap-[17px]">
              <span className="flex h-[19px] w-3.5 shrink-0 items-center text-[#E9A944]">
                <Phone className="size-[13px] fill-current" strokeWidth={0} aria-hidden="true" />
              </span>
              <a
                href={`tel:${phone.href}`}
                className="focus-visible:outline-ring hover:text-primary rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-orange-400"
              >
                {phone.display}
              </a>
            </div>
          ) : null}

          {email ? (
            <div className="flex gap-[17px]">
              <span className="flex h-[19px] w-3.5 shrink-0 items-center text-[#E9A944]">
                <MailMark className="h-2.5 w-3.5" />
              </span>
              <a
                href={`mailto:${email}`}
                className="focus-visible:outline-ring hover:text-primary break-all rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:text-orange-400"
              >
                {email}
              </a>
            </div>
          ) : null}

          {/* Nothing configured yet: the contact form, rather than invented details. */}
          {hasContact ? null : (
            <Link
              href="/contact"
              className="hover:text-primary text-center underline underline-offset-4 transition-colors"
            >
              Send us a message
            </Link>
          )}
        </address>
      </section>

      {/*
        The script line, centred, with Back to top beside it. The button was in
        the copyright row; the owner's design for that row (2026-10-16) has
        nothing but the centred text, so the button moved up here rather than
        being dropped. The side columns are equal so the script stays centred;
        below 360px the button is 36px so all three fit with air between.
      */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
        <div className="col-start-2 flex items-center gap-1.5">
          <ScriptAccent size="sm" className="leading-tight text-[#475569] dark:text-slate-400">
            <span>People, Purpose, Possibilities</span>
          </ScriptAccent>
          <HeartDoodle className="text-primary size-6" />
        </div>
        <BackToTop className="size-9 justify-self-end min-[360px]:size-11" />
      </div>

      {/*
        THE COPYRIGHT BAND (owner's design, 2026-10-16): full width, a #E8E8E8
        rule above a #FEF8EF band, everything centred — the notice in #666666
        (5.4:1 on the band) with the name semibold in #5F48A2 (6.8:1), and the
        legal links under it, 14px apart, without separators. 13px on 20px
        lines, sized from the design at its scale (≈1.67× a 390px phone).
        12px side padding so the notice is one line at 390px, as in the design;
        narrower, it breaks before "All Rights Reserved.", never inside it.
      */}
      <div className="dark:border-border dark:bg-surface-warm -mx-5 -mb-6 mt-6 border-t border-[#E8E8E8] bg-[#FEF8EF] px-3 pb-[15px] pt-[13px] text-center text-[13px] leading-5 text-[#666666] dark:text-slate-400">
        <p>
          Copyright © {year}{' '}
          <span className="font-semibold text-[#5F48A2] dark:text-violet-300">
            {siteConfig.name}
          </span>
          . <span className="whitespace-nowrap">All Rights Reserved.</span>
        </p>

        <ul className="mt-[11px] flex flex-wrap justify-center gap-x-3.5 gap-y-1">
          {legalNav.map((item) => (
            <li key={item.href}>
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
  );
}
