import Link from 'next/link';
import { ArrowRight, ChevronDown, Mail, MapPin, Phone } from 'lucide-react';

import { Button } from '@sailent/ui';

import { LeafSprig, Rays } from '@/components/about/decor';
import type { Organisation } from '@/lib/content/organisation';
import { footerCampaignsGroup, footerNav, legalNav, siteConfig } from '@/lib/site-config';

import { BackToTop } from './back-to-top';
import { BrandLockup } from './brand-mark';
import { SOCIAL_ICONS } from './social-icons';

/**
 * The footer on a phone, as the approved mobile design draws it.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * A DIFFERENT SHAPE FROM THE DESKTOP FOOTER, FROM THE SAME DATA.
 *
 * Five link groups stacked as columns are a long scroll on a phone, so here
 * each is a collapsed disclosure — native `<details>`, which needs no script,
 * opens with Enter or Space, and is announced as expandable. Links come from
 * `footerNav` (plus the phone-only Campaigns group); contact details and
 * social links from Admin → Settings, each left out when nobody has entered
 * it, exactly as on the desktop footer.
 *
 * The "Be part of the change" card is the design's own ask, sitting across the
 * footer's top edge.
 * ══════════════════════════════════════════════════════════════════════════
 */
export function MobileFooter({ organisation, year }: { organisation: Organisation; year: number }) {
  const { address } = organisation;
  const addressFirst = address.line1;
  const addressSecond = [address.city, address.state, address.country].filter(Boolean).join(', ');
  const groups = [footerNav[0]!, footerNav[1]!, footerCampaignsGroup, ...footerNav.slice(2)];

  return (
    <div className="md:hidden">
      {/* The card straddles the footer's top edge: page colour above, navy below. */}
      <div className="bg-[linear-gradient(to_bottom,var(--color-background)_60%,transparent_60%)] px-4 pb-2 pt-8">
        <div className="bg-surface relative overflow-hidden rounded-3xl px-6 pb-7 pt-7 shadow-[0_18px_40px_-20px_rgb(15_23_42/0.35)]">
          <Rays className="text-cta-glow absolute left-3 top-4 h-8 w-6" />
          <LeafSprig className="absolute -bottom-6 -right-3 h-32 w-auto opacity-80" />
          <div className="relative pl-6">
            <h2 className="font-display text-foreground text-[1.625rem] font-bold leading-tight">
              Be part of the change
            </h2>
            <p className="text-body-sm text-muted-foreground mt-2 leading-relaxed">
              Your support helps us work with communities to remove real barriers and create
              opportunities that last.
            </p>
            <Button asChild size="lg" fullWidth className="mt-5 h-12 rounded-full">
              <Link href="/donate">
                Donate Now
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 pt-7">
        <BrandLockup tone="inverse" href={null} tagline="always" />
        <p className="text-body mt-4 leading-relaxed text-white/80">
          Working with communities to create opportunities in education, health, livelihoods and
          social welfare.
        </p>

        {organisation.social.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-3">
            {organisation.social.map((link) => {
              const Icon = SOCIAL_ICONS[link.label];
              return (
                <li key={link.label}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${siteConfig.name} on ${link.label}`}
                    className="focus-visible:outline-ring grid size-12 place-items-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {Icon ? (
                      <Icon className="size-5" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true" className="text-body-sm font-semibold">
                        {link.label.slice(0, 1)}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* The link groups, collapsed. */}
        <div className="mt-6 border-t border-white/15">
          {groups.map((group) => (
            <details key={group.label} className="group border-b border-white/15">
              <summary className="text-body-lg focus-visible:outline-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white focus-visible:outline-2 focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
                {group.label}
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <ul className="pb-4">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-body focus-visible:outline-ring flex min-h-11 items-center rounded-sm text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        {/* Contact — whatever Admin → Settings holds, nothing invented. */}
        <address className="mt-7 space-y-5 not-italic">
          {addressFirst || addressSecond ? (
            <ContactRow icon={MapPin} title="Our Office">
              {addressFirst ? <span className="block">{addressFirst}</span> : null}
              {addressSecond ? <span className="block">{addressSecond}</span> : null}
            </ContactRow>
          ) : null}
          {organisation.email ? (
            <ContactRow icon={Mail} title="Email Us">
              <a
                href={`mailto:${organisation.email}`}
                className="focus-visible:outline-ring break-words rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {organisation.email}
              </a>
            </ContactRow>
          ) : null}
          {organisation.phoneDisplay && organisation.phoneHref ? (
            <ContactRow icon={Phone} title="Call Us">
              <a
                href={`tel:${organisation.phoneHref}`}
                className="focus-visible:outline-ring rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {organisation.phoneDisplay}
              </a>
            </ContactRow>
          ) : null}
        </address>

        <Link
          href="/contact"
          className="text-body-lg focus-visible:outline-ring mt-7 flex h-14 items-center justify-center gap-3 rounded-full border border-white/50 font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Mail className="size-6" aria-hidden="true" />
          Contact Us
          <ArrowRight className="size-5" aria-hidden="true" />
        </Link>

        <div className="mt-8 border-t border-white/15 pt-6">
          {/*
            Each link carries the divider before it, and the list is pulled left
            by one divider's width inside a clipped box, so whichever link starts
            a line has its divider clipped away — no stray "|" when they wrap.
          */}
          <div className="overflow-hidden">
            <ul className="-ml-6 flex flex-wrap items-center gap-y-1">
              {legalNav.map((item) => (
                <li
                  key={item.href}
                  className="relative pl-6 before:absolute before:left-[0.6875rem] before:top-1/2 before:h-3.5 before:-translate-y-1/2 before:border-l before:border-white/40"
                >
                  <Link
                    href={item.href}
                    className="text-body-sm focus-visible:outline-ring rounded-sm text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-body-sm text-white/70">
              © {year} {siteConfig.name}. All rights reserved.
            </p>
            <BackToTop />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MapPin;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <Icon className="text-cta-glow mt-0.5 size-6 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-body-lg font-semibold text-white">{title}</p>
        <div className="text-body mt-0.5 text-white/75">{children}</div>
      </div>
    </div>
  );
}
