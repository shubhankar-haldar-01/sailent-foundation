import Link from 'next/link';
import type { Metadata } from 'next';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Card } from '@sailent/ui';

import { PageShell, Section } from '@/components/layout/page-shell';
import { PageHero } from '@/components/sections/page-hero';
import { Breadcrumbs } from '@/components/sections/breadcrumbs';
import { ContactForm } from '@/components/forms/contact-form';
import { MediaFrame } from '@/components/media/media-frame';
import { demoOrg } from '@/lib/demo-org';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Contact us',
  description: 'How to reach the team — for donations, volunteering, partnerships or documents.',
  path: '/contact',
});

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch"
        lead="We answer within three working days. For anything about a specific donation, quote your donation reference and we can find it immediately."
      />

      <Section>
        <PageShell>
          <Breadcrumbs
            entries={[
              { name: 'Home', path: '/' },
              { name: 'Contact', path: '/contact' },
            ]}
          />

          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-h2 font-semibold">Where to find us</h2>

              {/*
                Only organizational contact details are published. Individual
                staff emails and phone numbers are deliberately absent — Phase 2
                requires that no private personal information is exposed.
              */}
              <address className="mt-6 space-y-5 not-italic">
                <div className="flex gap-3">
                  <MapPin
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-body-sm font-semibold">Registered office</p>
                    <p className="text-body-sm text-muted-foreground mt-0.5">
                      {demoOrg.address.line1}
                      <br />
                      {demoOrg.address.line2}
                      <br />
                      {demoOrg.address.city} {demoOrg.address.postalCode}
                      <br />
                      {demoOrg.address.state}, {demoOrg.address.country}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Mail
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-body-sm font-semibold">Email</p>
                    <a
                      href={`mailto:${demoOrg.email}`}
                      className="text-body-sm text-primary focus-visible:outline-ring mt-0.5 block rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {demoOrg.email}
                    </a>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Phone
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-body-sm font-semibold">Phone</p>
                    <a
                      href={`tel:${demoOrg.phoneHref}`}
                      className="text-body-sm text-primary focus-visible:outline-ring mt-0.5 block rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {demoOrg.phoneDisplay}
                    </a>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      {demoOrg.officeHours}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Clock
                    className="text-muted-foreground mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-body-sm font-semibold">Response time</p>
                    <p className="text-body-sm text-muted-foreground mt-0.5">
                      Three working days. Field teams may take longer during distribution weeks.
                    </p>
                  </div>
                </div>
              </address>

              {/*
                Illustrative map. A real embed is wired up once the address is
                confirmed; this keeps the layout honest about the space it needs.
              */}
              <div className="border-border mt-8 overflow-hidden rounded-lg border">
                <MediaFrame
                  media={{
                    seed: 'contact-map',
                    alt: `Map showing the office at ${demoOrg.address.line2}, ${demoOrg.address.city}`,
                  }}
                  aspect="video"
                  rounded={false}
                />
                <p className="bg-surface-sunken text-caption text-muted-foreground border-border border-t px-4 py-2">
                  {demoOrg.address.line1}, {demoOrg.address.city} · Illustrative map
                </p>
              </div>

              <Card className="bg-surface-sunken mt-8 p-5">
                <h3 className="text-body font-semibold">Looking for something specific?</h3>
                <ul className="text-body-sm mt-3 space-y-2">
                  <li>
                    <Link
                      href="/faq"
                      className="text-primary focus-visible:outline-ring rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Frequently asked questions
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/volunteer"
                      className="text-primary focus-visible:outline-ring rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      Volunteering with us
                    </Link>
                  </li>
                </ul>

                <h3 className="text-body mt-5 font-semibold">Follow the work</h3>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                  {demoOrg.social.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-sm text-primary focus-visible:outline-ring rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </PageShell>
      </Section>
    </>
  );
}
