import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from 'lucide-react';

import { demoOrg } from '@/lib/demo-org';
import { footerNav, legalNav, siteConfig } from '@/lib/site-config';
import { HeartDoodle } from '@/components/home/focus-icons';
import { ScriptAccent } from '@/components/sections/script-accent';

import { BrandLockup } from './brand-mark';

/**
 * Social icons, by label.
 *
 * A lookup rather than a field on `demoOrg`, because the icon is a property of
 * the network and the URL is a property of the organization — putting a
 * component reference in the data file would make that file un-serialisable
 * the day it comes from an API.
 */
const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  Instagram,
  LinkedIn: Linkedin,
  Facebook,
  YouTube: Youtube,
};

/**
 * Site footer.
 *
 * Five columns as approved: the brand block, four navigation columns and the
 * contact details, with the legal line beneath.
 *
 * There is NO newsletter form and no donate band here. Both were duplicates —
 * the newsletter has its own band directly above the footer, and the ask
 * already appears in the header, the hero, the donation widget, every campaign
 * card and the community panel. A sixth copy a few hundred pixels below the
 * fifth adds nothing and pushes the contact details further down.
 *
 * Contact details come from `@/lib/demo-org`, which holds DUMMY values so the
 * design can be reviewed complete. The statutory identifiers are NOT repeated
 * here — they live on /about, and a table of DEMO-marked registration numbers
 * under every page of the site was the tallest thing in a footer the approved
 * design keeps to five columns.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-accent-950 mt-auto text-white/85">
      <div className="container-page py-9 md:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-6">
          {/* Brand ---------------------------------------------------------- */}
          <div className="space-y-4 lg:col-span-3">
            <BrandLockup tone="inverse" href={null} />

            <ul className="flex flex-wrap gap-2">
              {demoOrg.social.map((link) => {
                const Icon = SOCIAL_ICONS[link.label];
                return (
                  <li key={link.label}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${siteConfig.name} on ${link.label}`}
                      className="focus-visible:outline-ring grid size-8 place-items-center rounded-full text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {Icon ? (
                        <Icon className="size-5" aria-hidden="true" />
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

          {/* Four link columns + contact ------------------------------------ */}
          {/* Four equal nav columns and a wider fifth. The contact column holds
              an email address, which is one unbreakable token — at an equal
              fifth it breaks mid-domain, and "hello@sailentfoundat / ion.org"
              is the one thing in a footer that has to be copyable by eye. */}
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-[1fr_1.25fr_1fr_0.85fr_1.6fr_1.15fr] lg:gap-6">
            {footerNav.map((group) => {
              const id = `footer-${group.label.replace(/\s+/g, '-').toLowerCase()}`;
              return (
                <nav key={group.label} aria-labelledby={id}>
                  <h2 id={id} className="text-body-sm font-bold text-white">
                    {group.label}
                  </h2>
                  <ul className="mt-2.5 space-y-1.5">
                    {group.items.map((item) => (
                      <li key={item.href} className="text-caption">
                        <Link
                          href={item.href}
                          className="focus-visible:outline-ring rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              );
            })}

            <div>
              <h2 id="footer-contact" className="text-body-sm font-bold text-white">
                Contact
              </h2>
              <address
                aria-labelledby="footer-contact"
                className="text-caption mt-2.5 space-y-1.5 not-italic text-white/75"
              >
                {/* Two lines, as approved. The one-line form runs to five
                    lines in a column this width and makes the footer the
                    tallest thing on the page. */}
                <span className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {demoOrg.address.line1},
                    <br />
                    {demoOrg.address.city}, {demoOrg.address.state}, {demoOrg.address.country}
                  </span>
                </span>
                <a
                  href={`tel:${demoOrg.phoneHref}`}
                  className="focus-visible:outline-ring flex items-center gap-2 rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                  {demoOrg.phoneDisplay}
                </a>
                <a
                  href={`mailto:${demoOrg.email}`}
                  className="focus-visible:outline-ring flex items-start gap-2 rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {/*
                    `min-w-0` is what makes the wrap possible at all: a flex
                    child defaults to `min-width: auto`, which floors it at the
                    width of its longest unbreakable run, and no amount of
                    `overflow-wrap` reduces that. Without it the address pushed
                    the page 35px wide at 1024.

                    `break-words`, not `break-all`, so it breaks at the @ or a
                    dot rather than mid-domain.
                  */}
                  <span className="min-w-0 break-words">{demoOrg.email}</span>
                </a>
              </address>
            </div>

            {/* The handwritten note, at the far right of the row as approved —
                three lines with the heart beside them, not underneath. */}
            <div className="hidden items-center gap-3 lg:flex">
              {/*
                One word per line, each STEPPED RIGHT of the one above it — the
                cascade is what makes this read as handwriting rather than as
                three stacked labels, and it is how the approved mark is drawn.
                
                The indents are in `em`, so the stagger keeps its proportion if
                the script size ever changes.

                The breaks are explicit rather than produced by squeezing the
                box: "People Purpose" and "Possibilities" are near enough the
                same width that any container wide enough for one fits the
                other too.
              */}
              <ScriptAccent size="sm" className="leading-tight text-white/90">
                <span className="block">People</span>
                <span className="block ps-[0.55em]">Purpose</span>
                <span className="block ps-[1.1em]">Possibilities</span>
              </ScriptAccent>
              <HeartDoodle className="text-cta-glow size-8 shrink-0" />
            </div>
          </div>
        </div>

        <div className="border-white/12 mt-7 flex flex-col gap-4 border-t pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-caption text-white/70">
            © {year} {siteConfig.name}. All rights reserved.
          </p>

          <ul className="flex flex-wrap items-center divide-white/25 sm:divide-x">
            {legalNav.map((item) => (
              <li key={item.href} className="px-3 first:pl-0 last:pr-0">
                <Link
                  href={item.href}
                  className="text-caption focus-visible:outline-ring rounded-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
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
